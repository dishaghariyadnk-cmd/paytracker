// PayTracker Core Application Logic
class PayTrackerApp {
  constructor() {
    this.selectedCategory = 'Groceries';
    this.salary = parseFloat(localStorage.getItem('paytracker_salary')) || 0;
    this.transactions = JSON.parse(localStorage.getItem('paytracker_transactions')) || [];
    this.ipoList = JSON.parse(localStorage.getItem('paytracker_ipoList')) || [];
    this.googleScriptUrl = localStorage.getItem('paytracker_googleScriptUrl') || '';
    this.offlineQueue = JSON.parse(localStorage.getItem('paytracker_offlineQueue')) || [];

    this.pieChart = null;
    this.barChart = null;

    this.init();
  }

  init() {
    this.renderHeaderAndMetrics();
    this.renderHistory();
    this.renderIPOList();
    this.loadSettings();
    this.checkSyncStatus();

    // Register Service Worker for PWA if running on HTTP/HTTPS
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration skipped for local file protocol'));
    }
  }

  // --- Category Selection ---
  selectCategory(categoryName, element) {
    this.selectedCategory = categoryName;
    document.querySelectorAll('.category-badge').forEach(el => el.classList.remove('active'));
    if (element) {
      element.classList.add('active');
    }
  }

  setAmount(val) {
    const input = document.getElementById('entryAmount');
    const current = parseFloat(input.value) || 0;
    input.value = current + val;
  }

  // --- Metrics Calculation ---
  renderHeaderAndMetrics() {
    document.getElementById('salaryDisplay').innerText = `₹${this.salary.toLocaleString('en-IN')}`;

    // Calculate total spent (excluding IPO blocked/refunded, only active expenses)
    const totalSpent = this.transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    
    // Total blocked in IPOs
    const blockedInIPO = this.ipoList
      .filter(item => item.status === 'Blocked')
      .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    const netSpentAndBlocked = totalSpent + blockedInIPO;
    const remainingBalance = this.salary - netSpentAndBlocked;

    document.getElementById('totalSpentDisplay').innerText = `₹${totalSpent.toLocaleString('en-IN')}`;
    document.getElementById('remainingBalanceDisplay').innerText = `₹${remainingBalance.toLocaleString('en-IN')}`;

    // Calculate Daily Safe-to-Spend limit
    const now = new Date();
    const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, totalDaysInMonth - now.getDate() + 1);
    const dailyLimit = remainingBalance > 0 ? Math.floor(remainingBalance / daysRemaining) : 0;

    document.getElementById('dailyLimitDisplay').innerText = `₹${dailyLimit.toLocaleString('en-IN')}/day`;

    // Progress bar
    const progressPct = this.salary > 0 ? Math.min(100, Math.round((netSpentAndBlocked / this.salary) * 100)) : 0;
    document.getElementById('progressBarFill').style.width = `${progressPct}%`;
    document.getElementById('progressPercentageText').innerText = `${progressPct}% Spent`;

    // Over-spending Alert Banner
    const alertBanner = document.getElementById('alertBanner');
    if (progressPct >= 80 && this.salary > 0) {
      alertBanner.classList.remove('hidden');
      document.getElementById('alertBannerText').innerText = `Warning: You have used ${progressPct}% of your monthly salary! (${daysRemaining} days left)`;
    } else {
      alertBanner.classList.add('hidden');
    }

    // IPO Badge Count
    const activeIpoCount = this.ipoList.filter(item => item.status === 'Blocked').length;
    document.getElementById('ipoBadgeCount').innerText = activeIpoCount;

    // Save state
    localStorage.setItem('paytracker_salary', this.salary);
    localStorage.setItem('paytracker_transactions', JSON.stringify(this.transactions));
    localStorage.setItem('paytracker_ipoList', JSON.stringify(this.ipoList));
  }

  // --- Handle New Entry ---
  async handleAddEntry(event) {
    event.preventDefault();
    const amountInput = document.getElementById('entryAmount');
    const amount = parseFloat(amountInput.value);
    const paymentMethod = document.getElementById('entryPaymentMethod').value;
    const notes = document.getElementById('entryNotes').value.trim();

    if (!amount || amount <= 0) {
      alert('Please enter a valid amount!');
      return;
    }

    const newTx = {
      id: 'TX-' + Date.now(),
      datetime: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      type: 'Expense',
      category: this.selectedCategory,
      amount: amount,
      paymentMethod: paymentMethod,
      notes: notes || `${this.selectedCategory} via ${paymentMethod}`,
      status: 'Completed'
    };

    // If category is IPO, also add to IPO tracker automatically
    if (this.selectedCategory === 'IPO') {
      const ipoItem = {
        id: 'IPO-' + Date.now(),
        name: notes || 'IPO Application',
        amount: amount,
        paymentMethod: paymentMethod,
        date: new Date().toLocaleDateString('en-IN'),
        status: 'Blocked' // Initial status
      };
      this.ipoList.unshift(ipoItem);
      this.renderIPOList();
    } else {
      this.transactions.unshift(newTx);
    }

    // Reset Form
    amountInput.value = '';
    document.getElementById('entryNotes').value = '';

    // Re-render UI
    this.renderHeaderAndMetrics();
    this.renderHistory();

    // Trigger Google Sheet Sync
    await this.syncTransactionToSheet(newTx);
  }

  // --- Google Sheet Syncing ---
  async syncTransactionToSheet(txItem) {
    if (!this.googleScriptUrl) {
      // Add to offline queue
      this.queueOffline(txItem);
      return;
    }

    try {
      this.setSyncStatus('syncing', 'Syncing...');
      const response = await fetch(this.googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(txItem)
      });
      const data = await response.json();

      if (data.result === 'success') {
        this.setSyncStatus('online', 'Sheet Synced');
      } else {
        this.queueOffline(txItem);
        this.setSyncStatus('offline', 'Sheet Pending');
      }
    } catch (err) {
      console.warn('Sync failed, queued offline:', err);
      this.queueOffline(txItem);
      this.setSyncStatus('offline', 'Sheet Pending');
    }
  }

  queueOffline(item) {
    this.offlineQueue.push(item);
    localStorage.setItem('paytracker_offlineQueue', JSON.stringify(this.offlineQueue));
  }

  async syncPendingData() {
    if (!this.googleScriptUrl) {
      alert('Please set your Google Apps Script Web App URL in the Sync tab first!');
      this.switchTab('settingsTab', document.querySelectorAll('.tab-btn')[3]);
      return;
    }

    if (this.offlineQueue.length === 0) {
      alert('All transactions are already synced to Google Sheet!');
      return;
    }

    try {
      this.setSyncStatus('syncing', 'Syncing Queue...');
      const response = await fetch(this.googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(this.offlineQueue)
      });
      const data = await response.json();

      if (data.result === 'success') {
        alert(`Successfully synced ${this.offlineQueue.length} pending entries to Google Sheet!`);
        this.offlineQueue = [];
        localStorage.setItem('paytracker_offlineQueue', JSON.stringify(this.offlineQueue));
        this.setSyncStatus('online', 'Sheet Synced');
      }
    } catch (err) {
      alert('Could not sync to Google Sheet. Check URL or internet connection.');
      this.setSyncStatus('offline', 'Sheet Pending');
    }
  }

  setSyncStatus(status, text) {
    const badge = document.getElementById('syncStatusBadge');
    const textEl = document.getElementById('syncText');
    badge.className = `sync-badge ${status}`;
    textEl.innerText = text;
  }

  checkSyncStatus() {
    if (!this.googleScriptUrl) {
      this.setSyncStatus('offline', 'Sheet Unlinked');
    } else if (this.offlineQueue.length > 0) {
      this.setSyncStatus('offline', `${this.offlineQueue.length} Pending`);
    } else {
      this.setSyncStatus('online', 'Sheet Ready');
    }
  }

  // --- Render Transaction History ---
  renderHistory() {
    const historyList = document.getElementById('historyList');
    const filter = document.getElementById('categoryFilter').value;

    let items = this.transactions;
    if (filter !== 'ALL') {
      items = items.filter(tx => tx.category === filter);
    }

    if (items.length === 0) {
      historyList.innerHTML = `<div class="empty-state">No transactions recorded yet.<br>Add your first entry above!</div>`;
      return;
    }

    const catIcons = {
      'Groceries': '🛒',
      'Petrol': '⛽',
      'Shopping': '🛍️',
      'Transfer to Husband': '📱',
      'Gas & Bills': '⚡',
      'IPO': '📈',
      'Food & Dining': '🍔',
      'Others': '💵'
    };

    historyList.innerHTML = items.map(tx => `
      <div class="tx-item">
        <div class="tx-left">
          <div class="tx-icon">${catIcons[tx.category] || '💸'}</div>
          <div class="tx-details">
            <h4>${tx.category}</h4>
            <div class="tx-meta">
              <span>${tx.datetime}</span> • <span>${tx.paymentMethod}</span>
              ${tx.notes ? ` • <span>${tx.notes}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="tx-right">
          <span class="tx-amount">-₹${tx.amount.toLocaleString('en-IN')}</span>
          <button class="tx-delete-btn" onclick="app.deleteTransaction('${tx.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  deleteTransaction(txId) {
    if (confirm('Delete this transaction entry?')) {
      this.transactions = this.transactions.filter(tx => tx.id !== txId);
      this.renderHeaderAndMetrics();
      this.renderHistory();
    }
  }

  // --- IPO Tracker Logic ---
  quickAddIPO() {
    const name = prompt('Enter IPO Name (e.g. Tata Tech IPO):');
    if (!name) return;
    const amountStr = prompt('Enter Blocked Amount (₹):', '15000');
    const amount = parseFloat(amountStr);
    if (!amount) return;

    const ipoItem = {
      id: 'IPO-' + Date.now(),
      name: name,
      amount: amount,
      paymentMethod: 'Netbanking (ASBA)',
      date: new Date().toLocaleDateString('en-IN'),
      status: 'Blocked'
    };

    this.ipoList.unshift(ipoItem);
    this.renderHeaderAndMetrics();
    this.renderIPOList();

    // Sync to sheet
    this.syncTransactionToSheet({
      id: ipoItem.id,
      datetime: ipoItem.date,
      type: 'IPO Application',
      category: 'IPO',
      amount: amount,
      paymentMethod: 'NetBanking',
      notes: name,
      status: 'Blocked'
    });
  }

  updateIPOStatus(ipoId, newStatus) {
    const item = this.ipoList.find(i => i.id === ipoId);
    if (item) {
      item.status = newStatus;
      this.renderHeaderAndMetrics();
      this.renderIPOList();
    }
  }

  deleteIPO(ipoId) {
    if (confirm('Remove this IPO entry?')) {
      this.ipoList = this.ipoList.filter(i => i.id !== ipoId);
      this.renderHeaderAndMetrics();
      this.renderIPOList();
    }
  }

  renderIPOList() {
    const ipoListEl = document.getElementById('ipoList');

    const blockedTotal = this.ipoList.filter(i => i.status === 'Blocked').reduce((a, b) => a + b.amount, 0);
    const allottedTotal = this.ipoList.filter(i => i.status === 'Allotted').reduce((a, b) => a + b.amount, 0);
    const refundedTotal = this.ipoList.filter(i => i.status === 'Refunded').reduce((a, b) => a + b.amount, 0);

    document.getElementById('ipoBlockedAmount').innerText = `₹${blockedTotal.toLocaleString('en-IN')}`;
    document.getElementById('ipoAllottedAmount').innerText = `₹${allottedTotal.toLocaleString('en-IN')}`;
    document.getElementById('ipoRefundedAmount').innerText = `₹${refundedTotal.toLocaleString('en-IN')}`;

    if (this.ipoList.length === 0) {
      ipoListEl.innerHTML = `<div class="empty-state">No IPO applications tracked yet.<br>Click "+ New IPO" to add one!</div>`;
      return;
    }

    ipoListEl.innerHTML = this.ipoList.map(item => `
      <div class="ipo-item">
        <div class="ipo-header">
          <div>
            <h4>📈 ${item.name}</h4>
            <div class="tx-meta">Applied on ${item.date} • ${item.paymentMethod}</div>
          </div>
          <span class="status-badge ${item.status.toLowerCase()}">${item.status}</span>
        </div>
        <div class="ipo-header">
          <strong style="font-size: 16px;">₹${item.amount.toLocaleString('en-IN')}</strong>
          <div class="ipo-actions">
            ${item.status === 'Blocked' ? `
              <button class="secondary-btn" style="padding:4px 8px; font-size:11px;" onclick="app.updateIPOStatus('${item.id}', 'Allotted')">🎉 Allotted</button>
              <button class="secondary-btn" style="padding:4px 8px; font-size:11px;" onclick="app.updateIPOStatus('${item.id}', 'Refunded')">↩️ Refunded</button>
            ` : ''}
            <button class="tx-delete-btn" onclick="app.deleteIPO('${item.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // --- Analytics Charts ---
  renderCharts() {
    // 1. Pie Chart
    const categories = ['Groceries', 'Petrol', 'Shopping', 'Transfer to Husband', 'Gas & Bills', 'Food & Dining', 'Others'];
    const dataByCat = categories.map(cat => {
      return this.transactions.filter(tx => tx.category === cat).reduce((sum, tx) => sum + tx.amount, 0);
    });

    const ctxPie = document.getElementById('categoryPieChart').getContext('2d');
    if (this.pieChart) this.pieChart.destroy();

    this.pieChart = new Chart(ctxPie, {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          data: dataByCat,
          backgroundColor: ['#10b981', '#f59e0b', '#ec4899', '#6366f1', '#3b82f6', '#8b5cf6', '#64748b']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } } }
        }
      }
    });

    // 2. Bar Chart (Daily Expenses)
    const ctxBar = document.getElementById('dailyBarChart').getContext('2d');
    if (this.barChart) this.barChart.destroy();

    // Group last 7 days
    const last7Days = [];
    const dayAmounts = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      last7Days.push(dateStr);

      const dayTotal = this.transactions
        .filter(tx => new Date(tx.id.replace('TX-', '') * 1).toLocaleDateString('en-IN') === d.toLocaleDateString('en-IN'))
        .reduce((sum, tx) => sum + tx.amount, 0);
      dayAmounts.push(dayTotal);
    }

    this.barChart = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: last7Days,
        datasets: [{
          label: 'Daily Spent (₹)',
          data: dayAmounts,
          backgroundColor: '#6366f1',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { ticks: { color: '#94a3b8' } },
          y: { ticks: { color: '#94a3b8' } }
        },
        plugins: {
          legend: { labels: { color: '#94a3b8' } }
        }
      }
    });
  }

  // --- Tabs Navigation ---
  switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(tabId).classList.remove('hidden');
    if (btnElement) btnElement.classList.add('active');

    if (tabId === 'analyticsTab') {
      this.renderCharts();
    }
  }

  // --- Modal & Settings ---
  openSalaryModal() {
    document.getElementById('salaryInputModal').value = this.salary || '';
    document.getElementById('salaryModal').classList.remove('hidden');
  }

  closeSalaryModal() {
    document.getElementById('salaryModal').classList.add('hidden');
  }

  saveSalaryFromModal() {
    const val = parseFloat(document.getElementById('salaryInputModal').value);
    if (!isNaN(val) && val >= 0) {
      this.salary = val;
      this.renderHeaderAndMetrics();
      this.closeSalaryModal();
    }
  }

  loadSettings() {
    document.getElementById('googleSheetScriptUrl').value = this.googleScriptUrl;
    fetch('./google_apps_script.js')
      .then(res => res.text())
      .then(text => {
        document.getElementById('appsScriptCodeSnippet').innerText = text;
      })
      .catch(() => {
        document.getElementById('appsScriptCodeSnippet').innerText = 'Apps Script snippet file available in workspace.';
      });
  }

  saveSettings() {
    const url = document.getElementById('googleSheetScriptUrl').value.trim();
    this.googleScriptUrl = url;
    localStorage.setItem('paytracker_googleScriptUrl', url);
    this.checkSyncStatus();
    alert('Google Apps Script Web App URL saved successfully!');
  }

  async testGoogleSheetConnection() {
    if (!this.googleScriptUrl) {
      alert('Please enter your Web App URL first!');
      return;
    }

    try {
      const testItem = {
        id: 'TEST-' + Date.now(),
        datetime: new Date().toLocaleString('en-IN'),
        type: 'Test Connection',
        category: 'Test',
        amount: 1,
        paymentMethod: 'Test',
        notes: 'Test sync connection from PayTracker App',
        status: 'Success'
      };

      const res = await fetch(this.googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(testItem)
      });
      const data = await res.json();

      if (data.result === 'success') {
        alert('🎉 Connection Successful! A test row has been appended to your Google Sheet!');
        this.setSyncStatus('online', 'Sheet Connected');
      } else {
        alert('Sync error: ' + JSON.stringify(data));
      }
    } catch (err) {
      alert('Connection failed: ' + err.toString() + '\nMake sure Web App is deployed with "Anyone" access.');
    }
  }

  copyAppsScriptCode() {
    const code = document.getElementById('appsScriptCodeSnippet').innerText;
    navigator.clipboard.writeText(code).then(() => {
      alert('Apps Script code copied to clipboard!');
    });
  }

  exportCSV() {
    if (this.transactions.length === 0) {
      alert('No data to export!');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,ID,Date,Category,Amount,PaymentMethod,Notes\n';
    this.transactions.forEach(tx => {
      csvContent += `"${tx.id}","${tx.datetime}","${tx.category}",${tx.amount},"${tx.paymentMethod}","${tx.notes}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PayTracker_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  clearAllData() {
    if (confirm('Are you sure you want to reset all local tracker data? (Google Sheet data will remain safe)')) {
      localStorage.clear();
      location.reload();
    }
  }
}

// Instantiate App
const app = new PayTrackerApp();
