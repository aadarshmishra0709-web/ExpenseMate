package expensemate;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.Executors;

public class Main {
    private static final Path DATA = Paths.get("..", "data").toAbsolutePath().normalize();
    private static final Set<String> RESOURCES = Set.of("transactions","budgets","goals","recurring","subscriptions","challenges");
    private static final Json JSON = new Json();

    public static void main(String[] args) throws Exception {
        Files.createDirectories(DATA);
        for (String r : RESOURCES) ensureFile(r);
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
        server.createContext("/api", Main::handle);
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        System.out.println("ExpenseMate Java API running at http://localhost:8080");
        System.out.println("Data directory: " + DATA);
    }

    private static void ensureFile(String resource) throws IOException {
        Path p = DATA.resolve(resource + ".json");
        if (!Files.exists(p)) Files.writeString(p, "[]", StandardCharsets.UTF_8);
    }
    @SuppressWarnings("unchecked")
    private static List<Map<String,Object>> read(String resource) throws IOException {
        ensureFile(resource);
        Object parsed = JSON.parse(Files.readString(DATA.resolve(resource + ".json"), StandardCharsets.UTF_8));
        if (!(parsed instanceof List<?> list)) return new ArrayList<>();
        List<Map<String,Object>> result = new ArrayList<>();
        for (Object item : list) if (item instanceof Map<?,?> m) result.add((Map<String,Object>)m);
        return result;
    }
    private static void write(String resource, List<Map<String,Object>> data) throws IOException {
        Files.writeString(DATA.resolve(resource + ".json"), JSON.stringify(data), StandardCharsets.UTF_8);
    }
    private static long nextId(List<Map<String,Object>> rows) {
        return rows.stream().mapToLong(x -> (long) number(x.get("id"))).max().orElse(0) + 1;
    }
    private static double number(Object o) {
        try { return Double.parseDouble(String.valueOf(o)); } catch(Exception e) { return 0; }
    }
    private static String str(Object o) { return o == null ? "" : String.valueOf(o); }
    private static Map<String,Object> obj(Object... kv) {
        Map<String,Object> m = new LinkedHashMap<>();
        for(int i=0;i<kv.length;i+=2) m.put(String.valueOf(kv[i]), kv[i+1]);
        return m;
    }
    private static void handle(HttpExchange ex) throws IOException {
        addCors(ex);
        if ("OPTIONS".equalsIgnoreCase(ex.getRequestMethod())) { ex.sendResponseHeaders(204,-1); return; }
        try {
            String path = ex.getRequestURI().getPath().replaceFirst("^/api/?","");
            String[] parts = path.isBlank() ? new String[0] : path.split("/");
            String resource = parts.length == 0 ? "" : parts[0];
            String method = ex.getRequestMethod();
            if ("summary".equals(resource) && "GET".equals(method)) { send(ex,200,summary()); return; }
            if ("transactions".equals(resource) && parts.length == 2 && "export".equals(parts[1]) && "GET".equals(method)) { csv(ex); return; }
            if (!RESOURCES.contains(resource)) { send(ex,404,obj("error","Unknown API endpoint")); return; }
            List<Map<String,Object>> rows = read(resource);
            if (parts.length == 1 && "GET".equals(method)) { send(ex,200,rows); return; }
            if (parts.length == 1 && "POST".equals(method)) {
                Map<String,Object> body = body(ex);
                validate(resource,body);
                body.put("id",nextId(rows));
                if ("goals".equals(resource)) body.putIfAbsent("saved",0.0);
                rows.add(body); write(resource,rows); send(ex,201,body); return;
            }
            if (parts.length >= 2) {
                long id;
                try { id = Long.parseLong(parts[1]); } catch(Exception e) { send(ex,400,obj("error","Invalid item id")); return; }
                Map<String,Object> item = rows.stream().filter(x -> number(x.get("id")) == id).findFirst().orElse(null);
                if (item == null) { send(ex,404,obj("error","Item not found")); return; }
                if ("goals".equals(resource) && parts.length == 3 && "contribute".equals(parts[2]) && "POST".equals(method)) {
                    double amount = number(body(ex).get("amount"));
                    if (amount <= 0) throw new IllegalArgumentException("Contribution must be greater than zero.");
                    item.put("saved",number(item.get("saved"))+amount); write(resource,rows); send(ex,200,item); return;
                }
                if ("PUT".equals(method) && parts.length == 2) {
                    Map<String,Object> updated = body(ex); validate(resource,updated); updated.put("id",id);
                    rows.set(rows.indexOf(item),updated); write(resource,rows); send(ex,200,updated); return;
                }
                if ("DELETE".equals(method) && parts.length == 2) {
                    rows.remove(item); write(resource,rows); send(ex,204,null); return;
                }
            }
            send(ex,405,obj("error","Method not supported"));
        } catch (IllegalArgumentException e) { send(ex,400,obj("error",e.getMessage())); }
          catch (Exception e) { e.printStackTrace(); send(ex,500,obj("error","Server error: "+e.getMessage())); }
    }
    private static void validate(String resource, Map<String,Object> b) {
        if ("transactions".equals(resource)) {
            if (!Set.of("INCOME","EXPENSE").contains(str(b.get("type")))) throw new IllegalArgumentException("Choose income or expense.");
            if (number(b.get("amount")) <= 0) throw new IllegalArgumentException("Amount must be greater than zero.");
            if (str(b.get("category")).isBlank() || str(b.get("date")).isBlank()) throw new IllegalArgumentException("Category and date are required.");
        }
        if ("budgets".equals(resource)) {
            if (number(b.get("limitAmount")) <= 0) throw new IllegalArgumentException("Budget limit must be greater than zero.");
            if (str(b.get("category")).isBlank() || str(b.get("month")).isBlank()) throw new IllegalArgumentException("Category and month are required.");
        }
        if ("goals".equals(resource)) {
            if (str(b.get("name")).isBlank() || number(b.get("target")) <= 0) throw new IllegalArgumentException("Goal name and a positive target are required.");
        }
        if (Set.of("recurring","subscriptions").contains(resource)) {
            if (str(b.get("name")).isBlank() || number(b.get("amount")) <= 0) throw new IllegalArgumentException("Name and a positive amount are required.");
        }
        if ("challenges".equals(resource) && (str(b.get("name")).isBlank() || number(b.get("days")) < 1)) throw new IllegalArgumentException("Challenge name and duration are required.");
    }
    private static Map<String,Object> summary() throws IOException {
        List<Map<String,Object>> tx = read("transactions"), goals = read("goals");
        double income=0,expense=0,goalSaved=0;
        String current=YearMonth.now().toString();
        Map<String,Double> cats=new TreeMap<>();
        Map<String,double[]> months=new TreeMap<>();
        for(int i=5;i>=0;i--) months.put(YearMonth.now().minusMonths(i).toString(),new double[2]);
        for(Map<String,Object> t:tx) {
            double amount=number(t.get("amount")); boolean inc="INCOME".equals(t.get("type"));
            if(inc) income+=amount; else expense+=amount;
            String date=str(t.get("date"));
            if(date.startsWith(current) && !inc) cats.merge(str(t.get("category")),amount,Double::sum);
            if(date.length()>=7 && months.containsKey(date.substring(0,7))) months.get(date.substring(0,7))[inc?0:1]+=amount;
        }
        for(Map<String,Object> g:goals) goalSaved+=number(g.get("saved"));
        List<Map<String,Object>> monthly=new ArrayList<>();
        months.forEach((k,v)->monthly.add(obj("month",k,"income",v[0],"expense",v[1])));
        List<Map<String,Object>> categories=new ArrayList<>();
        cats.forEach((k,v)->categories.add(obj("category",k,"amount",v)));
        List<String> insights=new ArrayList<>();
        if(income==0 && expense==0) insights.add("Add your first transactions to begin seeing spending insights.");
        else {
            if(income>0) insights.add("You have saved "+String.format(Locale.US,"%.1f",(income-expense)/income*100)+"% of your recorded income overall.");
            if(!cats.isEmpty()) { String top=cats.entrySet().stream().max(Map.Entry.comparingByValue()).get().getKey(); insights.add(top+" is your highest spending category this month."); }
            if(expense>income) insights.add("Recorded expenses are higher than recorded income. Review upcoming spending.");
        }
        return obj("income",income,"expense",expense,"balance",income-expense,"savingsRate",income>0?Math.round((income-expense)/income*100):0,"goalsSaved",goalSaved,"monthly",monthly,"categories",categories,"insights",insights);
    }
    private static void csv(HttpExchange ex) throws IOException {
        StringBuilder out=new StringBuilder("id,type,amount,category,description,date,paymentMethod\n");
        for(Map<String,Object> t:read("transactions")) {
            out.append(csvCell(t.get("id"))).append(',').append(csvCell(t.get("type"))).append(',').append(csvCell(t.get("amount"))).append(',').append(csvCell(t.get("category"))).append(',').append(csvCell(t.get("description"))).append(',').append(csvCell(t.get("date"))).append(',').append(csvCell(t.get("paymentMethod"))).append('\n');
        }
        byte[] bytes=out.toString().getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type","text/csv; charset=utf-8");
        ex.getResponseHeaders().set("Content-Disposition","attachment; filename=expensemate-transactions.csv");
        ex.sendResponseHeaders(200,bytes.length); ex.getResponseBody().write(bytes); ex.close();
    }
    private static String csvCell(Object o) { String s=str(o).replace("\"","\"\""); return "\""+s+"\""; }
    @SuppressWarnings("unchecked")
    private static Map<String,Object> body(HttpExchange ex) throws IOException {
        String raw=new String(ex.getRequestBody().readAllBytes(),StandardCharsets.UTF_8);
        Object parsed=JSON.parse(raw);
        if(!(parsed instanceof Map<?,?>)) throw new IllegalArgumentException("Request body must be a JSON object.");
        return new LinkedHashMap<>((Map<String,Object>)parsed);
    }
    private static void addCors(HttpExchange ex) {
        ex.getResponseHeaders().set("Access-Control-Allow-Origin","*");
        ex.getResponseHeaders().set("Access-Control-Allow-Methods","GET,POST,PUT,DELETE,OPTIONS");
        ex.getResponseHeaders().set("Access-Control-Allow-Headers","Content-Type");
    }
    private static void send(HttpExchange ex,int status,Object value) throws IOException {
        if(status==204){ex.sendResponseHeaders(204,-1);ex.close();return;}
        byte[] bytes=JSON.stringify(value).getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type","application/json; charset=utf-8");
        ex.sendResponseHeaders(status,bytes.length);ex.getResponseBody().write(bytes);ex.close();
    }

    // Small JSON reader/writer so the Java backend has no third-party runtime dependencies.
    static class Json {
        private String s; private int i;
        Object parse(String input) {
            s=input==null?"":input; i=0; skip(); Object v=value(); skip();
            if(i<s.length()) throw new IllegalArgumentException("Unexpected JSON content.");
            return v;
        }
        private Object value() {
            skip(); if(i>=s.length()) throw new IllegalArgumentException("Empty JSON body.");
            char c=s.charAt(i);
            if(c=='{') return object(); if(c=='[') return array(); if(c=='"') return string();
            if(c=='t'&&take("true")) return true; if(c=='f'&&take("false")) return false; if(c=='n'&&take("null")) return null;
            return numeric();
        }
        private Map<String,Object> object() {
            Map<String,Object> m=new LinkedHashMap<>(); i++; skip(); if(peek('}')){i++;return m;}
            while(true){skip();String k=string();skip();expect(':');m.put(k,value());skip();if(peek('}')){i++;return m;}expect(',');}
        }
        private List<Object> array() {
            List<Object> a=new ArrayList<>();i++;skip();if(peek(']')){i++;return a;}
            while(true){a.add(value());skip();if(peek(']')){i++;return a;}expect(',');}
        }
        private String string() {
            expect('"');StringBuilder b=new StringBuilder();
            while(i<s.length()){char c=s.charAt(i++);if(c=='"')return b.toString();if(c=='\\'){if(i>=s.length())break;char e=s.charAt(i++);switch(e){case '"','\\','/'->b.append(e);case 'b'->b.append('\b');case 'f'->b.append('\f');case 'n'->b.append('\n');case 'r'->b.append('\r');case 't'->b.append('\t');case 'u'->{if(i+4>s.length())throw new IllegalArgumentException("Bad unicode escape");b.append((char)Integer.parseInt(s.substring(i,i+4),16));i+=4;}default->throw new IllegalArgumentException("Bad escape");}}else b.append(c);}
            throw new IllegalArgumentException("Unterminated string.");
        }
        private Number numeric() {
            int start=i;while(i<s.length()&&"-+0123456789.eE".indexOf(s.charAt(i))>=0)i++;
            if(start==i)throw new IllegalArgumentException("Invalid JSON value.");
            String n=s.substring(start,i);try{double d=Double.parseDouble(n);return d==(long)d?(long)d:d;}catch(Exception e){throw new IllegalArgumentException("Invalid number.");}
        }
        private boolean take(String x){if(s.startsWith(x,i)){i+=x.length();return true;}return false;}
        private void skip(){while(i<s.length()&&Character.isWhitespace(s.charAt(i)))i++;}
        private boolean peek(char c){return i<s.length()&&s.charAt(i)==c;}
        private void expect(char c){skip();if(!peek(c))throw new IllegalArgumentException("Expected '"+c+"' in JSON.");i++;}
        String stringify(Object v) {
            if(v==null)return "null";if(v instanceof String)return quote((String)v);if(v instanceof Number||v instanceof Boolean)return v.toString();
            if(v instanceof Map<?,?> m){StringJoiner j=new StringJoiner(",","{","}");m.forEach((k,x)->j.add(quote(String.valueOf(k))+":"+stringify(x)));return j.toString();}
            if(v instanceof Iterable<?> a){StringJoiner j=new StringJoiner(",","[","]");for(Object x:a)j.add(stringify(x));return j.toString();}
            return quote(v.toString());
        }
        private String quote(String x){StringBuilder b=new StringBuilder("\"");for(char c:x.toCharArray()){switch(c){case '"'->b.append("\\\"");case '\\'->b.append("\\\\");case '\n'->b.append("\\n");case '\r'->b.append("\\r");case '\t'->b.append("\\t");default->{if(c<32)b.append(String.format("\\u%04x",(int)c));else b.append(c);}}}return b.append('"').toString();}
    }
}
