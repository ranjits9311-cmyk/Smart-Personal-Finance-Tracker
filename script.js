const balance = document.getElementById('balance');
const list = document.getElementById('list');
const text = document.getElementById('text');
const amount = document.getElementById('amount');

let transactions = [];

function addTransaction() {
    if (text.value.trim() === '' || amount.value.trim() === '') {
        alert('Please add a description and amount');
        return;
    }

    const transaction = {
        id: Math.floor(Math.random() * 1000000),
        text: text.value,
        amount: +amount.value
    };

    transactions.push(transaction);
    updateDOM();
    
    text.value = '';
    amount.value = '';
}

function updateDOM() {
    list.innerHTML = '';
    
    transactions.forEach(transaction => {
        const sign = transaction.amount < 0 ? '-' : '+';
        const item = document.createElement('li');
        item.classList.add(transaction.amount < 0 ? 'minus' : 'plus');
        
        item.innerHTML = `
            ${transaction.text} <span>${sign}${Math.abs(transaction.amount)}</span>
        `;
        
        list.appendChild(item);
    });

    const total = transactions.reduce((acc, item) => (acc += item.amount), 0).toFixed(2);
    balance.innerText = `$${total}`;
}