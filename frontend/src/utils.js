export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
export const today = () => new Date().toLocaleDateString('en-CA');
export const monthNow = () => today().slice(0, 7);
export const expenseCategories = ['Food','Shopping','Transportation','Education','Entertainment','Healthcare','Bills','Rent','Other'];
export const incomeCategories = ['Salary','Freelancing','Business','Other'];
export const paymentMethods = ['UPI','Cash','Card','Bank transfer'];
