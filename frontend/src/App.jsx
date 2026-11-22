import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { money, today, monthNow, expenseCategories, incomeCategories, paymentMethods } from './utils';

const pages = [
  ['dashboard','Overview'],['transactions','Transactions'],['budgets','Budgets'],['goals','Savings goals'],
  ['analytics','Analytics'],['recurring','Recurring'],['subscriptions','Subscriptions'],
  ['challenge','No-spend challenge'],['calendar','Financial calendar']
];
const blankTx = () => ({ type:'EXPENSE', amount:'', category:'Food', description:'', date:today(), paymentMethod:'UPI' });
function useData(resource) {
  const [data,setData] = useState([]);
  const [error,setError] = useState('');
  const reload = async () => { try { setData(await api.get(resource)); setError(''); } catch(e) { setError(e.message); } };
  useEffect(() => { reload(); }, [resource]);
  return [data,reload,error];
}
function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label>; }
function Notice({children}) { return children ? <p className="error" role="alert">{children}</p> : null; }
function Bar({value,max}) { const pct=max>0?Math.min(100,value/max*100):0; return <div className="bar"><span style={{width:pct+'%'}} /></div>; }

export default function App() {
  const [page,setPage] = useState('dashboard');
  const [transactions,reloadTx,txError] = useData('transactions');
  const [budgets,reloadBudgets,budgetError] = useData('budgets');
  const [goals,reloadGoals,goalError] = useData('goals');
  const [recurring,reloadRecurring] = useData('recurring');
  const [subscriptions,reloadSubs] = useData('subscriptions');
  const [challenges,reloadChallenges] = useData('challenges');
  const [summary,setSummary] = useState(null);
  const [globalError,setGlobalError] = useState('');
  const refresh = async () => {
    await Promise.all([reloadTx(),reloadBudgets(),reloadGoals(),reloadRecurring(),reloadSubs(),reloadChallenges()]);
    try { setSummary(await api.summary()); setGlobalError(''); } catch(e) { setGlobalError(e.message); }
  };
  useEffect(() => { refresh(); }, []);
  const [txForm,setTxForm] = useState(blankTx());
  const [editId,setEditId] = useState(null);
  const [txFilter,setTxFilter] = useState({q:'',type:'',category:''});
  const [budgetForm,setBudgetForm] = useState({category:'Food',limitAmount:'',month:monthNow()});
  const [goalForm,setGoalForm] = useState({name:'',target:''});
  const [goalAmounts,setGoalAmounts] = useState({});
  const [recForm,setRecForm] = useState({name:'',type:'EXPENSE',amount:'',category:'Food',frequency:'MONTHLY',nextDate:today()});
  const [subForm,setSubForm] = useState({name:'',amount:'',frequency:'MONTHLY',nextDate:today(),category:'Entertainment'});
  const [challengeForm,setChallengeForm] = useState({name:'No-spend challenge',startDate:today(),days:7});
  const [notice,setNotice] = useState('');
  const [loading,setLoading] = useState(false);
  const categories = txForm.type === 'INCOME' ? incomeCategories : expenseCategories;
  const filtered = useMemo(() => transactions.filter(t =>
    (!txFilter.type || t.type===txFilter.type) &&
    (!txFilter.category || t.category===txFilter.category) &&
    (!txFilter.q || (t.description+' '+t.category).toLowerCase().includes(txFilter.q.toLowerCase()))
  ).sort((a,b)=>b.date.localeCompare(a.date)),[transactions,txFilter]);
  async function act(fn) { setLoading(true); setNotice(''); try { await fn(); await refresh(); } catch(e) { setNotice(e.message); } finally { setLoading(false); } }
  async function saveTransaction(e) {
    e.preventDefault();
    if (!(Number(txForm.amount)>0)) return setNotice('Enter an amount greater than zero.');
    const value={...txForm,amount:Number(txForm.amount)};
    await act(async()=>{ if(editId) await api.update('transactions',editId,value); else await api.create('transactions',value); setTxForm(blankTx()); setEditId(null); });
  }
  async function deleteItem(resource,id) { if(window.confirm('Delete this item?')) await act(()=>api.remove(resource,id)); }
  const income=summary?.income||0, expense=summary?.expense||0;
  const chartMax=Math.max(1,...(summary?.monthly||[]).flatMap(x=>[x.income,x.expense]));
  function renderDashboard() {
    return <><header className="page-head"><div><p className="eyebrow">YOUR MONEY, IN FOCUS</p><h1>Financial overview</h1><p className="muted">A clear picture of what comes in, what goes out and what you are building.</p></div><button className="primary" onClick={()=>setPage('transactions')}>Add transaction</button></header>
      {globalError && <Notice>{globalError}</Notice>}
      <section className="metrics">
        <article className="metric featured"><span>Total balance</span><strong>{money(summary?.balance)}</strong><small>Income minus expenses</small></article>
        <article className="metric"><span>Income</span><strong>{money(income)}</strong><small className="positive">Money received</small></article>
        <article className="metric"><span>Expenses</span><strong>{money(expense)}</strong><small>Money spent</small></article>
        <article className="metric"><span>Savings rate</span><strong>{summary?.savingsRate ?? 0}%</strong><small>Of recorded income</small></article>
      </section>
      <div className="two-col">
        <section className="panel"><div className="section-head"><div><h2>Income and expenses</h2><p className="muted">Last six months</p></div><span className="legend"><i className="income-dot"/> Income <i className="expense-dot"/> Expenses</span></div>
          <div className="chart">{(summary?.monthly||[]).map(m=><div className="chart-month" key={m.month}><div className="bar-pair"><i className="income-bar" style={{height:(m.income/chartMax*100)+'%'}}/><i className="expense-bar" style={{height:(m.expense/chartMax*100)+'%'}}/></div><small>{m.month.slice(5)}</small></div>)}</div>
        </section>
        <section className="panel"><h2>Spending by category</h2><p className="muted">This month</p>{(summary?.categories||[]).length ? summary.categories.map(c=><div className="category-line" key={c.category}><div className="split"><span>{c.category}</span><strong>{money(c.amount)}</strong></div><Bar value={c.amount} max={Math.max(1,...summary.categories.map(x=>x.amount))}/></div>) : <p className="empty">No expenses recorded this month.</p>}</section>
      </div>
      <div className="two-col"><section className="panel"><h2>Spending insights</h2>{(summary?.insights||['Add transactions to see useful spending insights.']).map((x,i)=><p className="insight" key={i}>{x}</p>)}</section>
      <section className="panel"><h2>Recent transactions</h2>{transactions.slice(0,5).length?transactions.slice(0,5).map(t=><div className="list-row" key={t.id}><div><strong>{t.category}</strong><small>{t.date} · {t.description||t.paymentMethod}</small></div><b className={t.type==='INCOME'?'positive':'negative'}>{t.type==='INCOME'?'+':'−'}{money(t.amount)}</b></div>):<p className="empty">Your recent activity will appear here.</p>}</section></div>
    </>;
  }
  function renderTransactions() {
    return <><header className="page-head"><div><p className="eyebrow">RECORD AND REVIEW</p><h1>Transactions</h1><p className="muted">Keep every income and expense in one place.</p></div><a className="button-link" href={api.exportUrl}>Export CSV</a></header>
      <form className="panel" onSubmit={saveTransaction}><h2>{editId?'Edit transaction':'Add a transaction'}</h2><div className="form-grid">
        <Field label="Type"><select value={txForm.type} onChange={e=>setTxForm({...txForm,type:e.target.value,category:e.target.value==='INCOME'?'Salary':'Food'})}><option value="EXPENSE">Expense</option><option value="INCOME">Income</option></select></Field>
        <Field label="Amount (₹)"><input type="number" min="0.01" step="0.01" value={txForm.amount} onChange={e=>setTxForm({...txForm,amount:e.target.value})} required/></Field>
        <Field label="Category"><select value={txForm.category} onChange={e=>setTxForm({...txForm,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Date"><input type="date" value={txForm.date} onChange={e=>setTxForm({...txForm,date:e.target.value})} required/></Field>
        <Field label="Payment method"><select value={txForm.paymentMethod} onChange={e=>setTxForm({...txForm,paymentMethod:e.target.value})}>{paymentMethods.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Description"><input maxLength="180" value={txForm.description} onChange={e=>setTxForm({...txForm,description:e.target.value})} placeholder="What was this for?"/></Field>
      </div><Notice>{notice}</Notice><div className="actions"><button className="primary" disabled={loading}>{editId?'Save changes':'Add transaction'}</button>{editId&&<button type="button" onClick={()=>{setEditId(null);setTxForm(blankTx());}}>Cancel</button>}</div></form>
      <section className="panel"><div className="filters"><input placeholder="Search description or category" value={txFilter.q} onChange={e=>setTxFilter({...txFilter,q:e.target.value})}/><select value={txFilter.type} onChange={e=>setTxFilter({...txFilter,type:e.target.value})}><option value="">All types</option><option value="INCOME">Income</option><option value="EXPENSE">Expense</option></select><select value={txFilter.category} onChange={e=>setTxFilter({...txFilter,category:e.target.value})}><option value="">All categories</option>{[...expenseCategories,...incomeCategories].map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Method</th><th className="right">Amount</th><th>Actions</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td>{t.date}</td><td>{t.type}</td><td>{t.category}</td><td>{t.description}</td><td>{t.paymentMethod}</td><td className="right">{money(t.amount)}</td><td><button className="small-button" onClick={()=>{setEditId(t.id);setTxForm({...t,amount:String(t.amount)});window.scrollTo(0,0);}}>Edit</button> <button className="small-button danger-text" onClick={()=>deleteItem('transactions',t.id)}>Delete</button></td></tr>)}</tbody></table>{!filtered.length&&<p className="empty">No matching transactions.</p>}</div></section></>;
  }
  function renderBudgets() {
    return <><header className="page-head"><div><p className="eyebrow">PLAN YOUR SPENDING</p><h1>Budgets</h1><p className="muted">Set monthly limits and see how much room remains.</p></div></header>
      <form className="panel" onSubmit={e=>{e.preventDefault();act(()=>api.create('budgets',{...budgetForm,limitAmount:Number(budgetForm.limitAmount)}));setBudgetForm({...budgetForm,limitAmount:''});}}><h2>Set a category budget</h2><div className="form-grid"><Field label="Month"><input type="month" value={budgetForm.month} onChange={e=>setBudgetForm({...budgetForm,month:e.target.value})}/></Field><Field label="Category"><select value={budgetForm.category} onChange={e=>setBudgetForm({...budgetForm,category:e.target.value})}>{expenseCategories.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Monthly limit (₹)"><input type="number" min="1" value={budgetForm.limitAmount} onChange={e=>setBudgetForm({...budgetForm,limitAmount:e.target.value})} required/></Field></div><Notice>{notice}</Notice><div className="actions"><button className="primary">Save budget</button></div></form>
      <section className="panel"><div className="section-head"><h2>Budget progress</h2><span className="muted">{budgets.length} budgets</span></div>{budgets.map(b=><div className="budget-item" key={b.id}><div className="split"><strong>{b.category} · {b.month}</strong><b>{money(b.spent)} / {money(b.limitAmount)}</b></div><Bar value={b.spent} max={b.limitAmount}/><div className="split"><small className={b.spent>=b.limitAmount?'negative':b.spent/b.limitAmount>=.8?'warning':'muted'}>{b.spent>=b.limitAmount?'Over budget':b.spent/b.limitAmount>=.8?'80% or more used':'Within budget'}</small><button className="small-button" onClick={()=>deleteItem('budgets',b.id)}>Remove</button></div></div>)}{!budgets.length&&<p className="empty">No budgets yet. Create a category limit above.</p>}</section></>;
  }
  function renderGoals() {
    return <><header className="page-head"><div><p className="eyebrow">SAVE WITH PURPOSE</p><h1>Savings goals</h1><p className="muted">Turn a target into a series of achievable steps.</p></div></header>
      <form className="panel" onSubmit={e=>{e.preventDefault();act(()=>api.create('goals',{...goalForm,target:Number(goalForm.target)}));setGoalForm({name:'',target:''});}}><h2>Create a goal</h2><div className="form-grid"><Field label="Goal name"><input value={goalForm.name} onChange={e=>setGoalForm({...goalForm,name:e.target.value})} required/></Field><Field label="Target amount (₹)"><input type="number" min="1" value={goalForm.target} onChange={e=>setGoalForm({...goalForm,target:e.target.value})} required/></Field></div><Notice>{notice}</Notice><div className="actions"><button className="primary">Create goal</button></div></form>
      <div className="goal-grid">{goals.map(g=><article className="panel goal-card" key={g.id}><div className="split"><h2>{g.name}</h2><button className="small-button danger-text" onClick={()=>deleteItem('goals',g.id)}>Delete</button></div><strong className="goal-total">{money(g.saved)} <small>of {money(g.target)}</small></strong><Bar value={g.saved} max={g.target}/><p className="muted">{money(Math.max(0,g.target-g.saved))} remaining</p><form className="inline-form" onSubmit={e=>{e.preventDefault();act(()=>api.contribute(g.id,Number(goalAmounts[g.id])));setGoalAmounts({...goalAmounts,[g.id]:''});}}><input type="number" min="1" placeholder="Contribution ₹" value={goalAmounts[g.id]||''} onChange={e=>setGoalAmounts({...goalAmounts,[g.id]:e.target.value})} required/><button className="primary">Add</button></form></article>)}</div>{!goals.length&&<p className="empty">No savings goals yet.</p>}</>;
  }
  function renderGeneric(resource,title,form,fields,items,renderItem) {
    return <><header className="page-head"><div><p className="eyebrow">PLAN AHEAD</p><h1>{title}</h1><p className="muted">Keep upcoming commitments visible and organized.</p></div></header>
      <form className="panel" onSubmit={e=>{e.preventDefault();act(()=>api.create(resource,form));}}><h2>Add {title.toLowerCase().replace(/s$/,'')}</h2><div className="form-grid">{fields}</div><div className="actions"><button className="primary">Save</button></div><Notice>{notice}</Notice></form>
      <section className="panel"><h2>Your {title.toLowerCase()}</h2>{items.map(item=><div className="list-row" key={item.id}>{renderItem(item)}<button className="small-button danger-text" onClick={()=>deleteItem(resource,item.id)}>Delete</button></div>)}{!items.length&&<p className="empty">Nothing added yet.</p>}</section></>;
  }
  const field = (label,value,onChange,type='text') => <Field label={label}><input type={type} value={value} onChange={onChange} required/></Field>;
  let content;
  if(page==='dashboard') content=renderDashboard();
  else if(page==='transactions') content=renderTransactions();
  else if(page==='budgets') content=renderBudgets();
  else if(page==='goals') content=renderGoals();
  else if(page==='analytics') content=<><header className="page-head"><div><p className="eyebrow">UNDERSTAND YOUR HABITS</p><h1>Analytics</h1><p className="muted">A practical view of your recorded financial activity.</p></div><a className="button-link" href={api.exportUrl}>Export transactions CSV</a></header><section className="metrics"><article className="metric"><span>Total income</span><strong>{money(income)}</strong></article><article className="metric"><span>Total expenses</span><strong>{money(expense)}</strong></article><article className="metric"><span>Net savings</span><strong>{money(income-expense)}</strong></article><article className="metric"><span>Savings rate</span><strong>{summary?.savingsRate||0}%</strong></article></section><section className="panel"><h2>Category breakdown</h2>{(summary?.categories||[]).map(c=><div className="category-line"><div className="split"><span>{c.category}</span><b>{money(c.amount)}</b></div><Bar value={c.amount} max={Math.max(1,...summary.categories.map(x=>x.amount))}/></div>)}</section></>;
  else if(page==='recurring') content=renderGeneric('recurring','Recurring transactions',recForm,<>{field('Name',recForm.name,e=>setRecForm({...recForm,name:e.target.value}))}{field('Amount (₹)',recForm.amount,e=>setRecForm({...recForm,amount:e.target.value}),'number')}<Field label="Type"><select value={recForm.type} onChange={e=>setRecForm({...recForm,type:e.target.value})}><option>EXPENSE</option><option>INCOME</option></select></Field><Field label="Frequency"><select value={recForm.frequency} onChange={e=>setRecForm({...recForm,frequency:e.target.value})}><option>WEEKLY</option><option>MONTHLY</option><option>YEARLY</option></select></Field>{field('Next date',recForm.nextDate,e=>setRecForm({...recForm,nextDate:e.target.value}),'date')}</>,recurring,x=><div><strong>{x.name}</strong><small>{x.type} · {money(x.amount)} · {x.frequency} · {x.nextDate}</small></div>);
  else if(page==='subscriptions') content=renderGeneric('subscriptions','Subscriptions',subForm,<>{field('Subscription name',subForm.name,e=>setSubForm({...subForm,name:e.target.value}))}{field('Amount (₹)',subForm.amount,e=>setSubForm({...subForm,amount:e.target.value}),'number')}<Field label="Frequency"><select value={subForm.frequency} onChange={e=>setSubForm({...subForm,frequency:e.target.value})}><option>MONTHLY</option><option>YEARLY</option></select></Field>{field('Next payment',subForm.nextDate,e=>setSubForm({...subForm,nextDate:e.target.value}),'date')}</>,subscriptions,x=><div><strong>{x.name}</strong><small>{money(x.amount)} · {x.frequency} · Next: {x.nextDate}</small></div>);
  else if(page==='challenge') content=renderGeneric('challenges','No-spend challenges',challengeForm,<>{field('Challenge name',challengeForm.name,e=>setChallengeForm({...challengeForm,name:e.target.value}))}{field('Start date',challengeForm.startDate,e=>setChallengeForm({...challengeForm,startDate:e.target.value}),'date')}{field('Duration (days)',String(challengeForm.days),e=>setChallengeForm({...challengeForm,days:Number(e.target.value)}),'number')}</>,challenges,x=><div><strong>{x.name}</strong><small>{x.startDate} · {x.days} days · {x.completedDays||0} days recorded</small></div>);
  else if(page==='calendar') content=<><header className="page-head"><div><p className="eyebrow">DATES THAT MATTER</p><h1>Financial calendar</h1><p className="muted">Upcoming scheduled payments and recorded transactions.</p></div></header><section className="panel"><h2>Upcoming subscriptions and recurring items</h2>{[...subscriptions,...recurring].sort((a,b)=>(a.nextDate||'').localeCompare(b.nextDate||'')).map(x=><div className="list-row"><div><strong>{x.name}</strong><small>{x.nextDate} · {money(x.amount)}</small></div></div>)}{![...subscriptions,...recurring].length&&<p className="empty">Add recurring items or subscriptions to see them here.</p>}</section><section className="panel"><h2>Recent transactions</h2>{transactions.slice(0,20).map(t=><div className="list-row"><div><strong>{t.category}</strong><small>{t.date} · {t.description}</small></div><b>{money(t.amount)}</b></div>)}</section></>;
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">E</span><span>ExpenseMate<small>Personal finance</small></span></div><p className="nav-label">WORKSPACE</p><nav>{pages.map(([key,label])=><button key={key} className={'nav-item '+(page===key?'active':'')} onClick={()=>setPage(key)}>{label}</button>)}</nav><div className="sidebar-note"><strong>Small steps add up.</strong><p>Make your money decisions easier to understand.</p></div></aside><main className="main-content">{content}<footer>ExpenseMate · Personal finance, made clearer</footer></main></div>;
}
