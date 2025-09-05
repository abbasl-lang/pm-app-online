document.addEventListener('DOMContentLoaded', function() {
    // --- GLOBAL VARIABLES ---
    let pmScheduleData = [];
    let statusChart;
    const today = new Date();

    // --- DOM ELEMENTS ---
    const tableBody = document.getElementById('pm-schedule-table');
    const searchInput = document.getElementById('searchInput');
    const taskModal = $('#taskModal');
    const saveTaskBtn = document.getElementById('saveTaskBtn');
    const addNewTaskBtn = document.getElementById('addNewTaskBtn');

    // --- API FUNCTIONS ---
    async function fetchData() {
        try {
            const response = await fetch('/api/schedule');
            pmScheduleData = await response.json();
            refreshDisplay();
        } catch (error) {
            console.error('Failed to fetch data:', error);
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้</td></tr>';
        }
    }

    async function saveTask(taskData) {
        const id = document.getElementById('taskId').value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/schedule/${id}` : '/api/schedule';

        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        await fetchData(); // Refresh data from server
    }

    async function deleteTask(id) {
        if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบใบงานนี้?')) {
            await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
            await fetchData();
        }
    }
    
    // --- RENDER FUNCTIONS ---
    function refreshDisplay() {
        renderTable();
        updateKpiCards();
        renderStatusChart();
    }

    function renderTable() {
        tableBody.innerHTML = '';
        const searchTerm = searchInput.value.toLowerCase();
        const filteredData = pmScheduleData.filter(item =>
            Object.values(item).some(val =>
                String(val).toLowerCase().includes(searchTerm)
            )
        );

        if (filteredData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">ไม่พบข้อมูล</td></tr>';
            return;
        }

        filteredData.forEach(item => {
            const row = document.createElement('tr');
            const currentStatus = getTaskStatus(item);
            row.className = currentStatus === 'เกินกำหนด' ? 'table-danger' : '';
            row.innerHTML = `
                <td>${item.machineType}</td>
                <td>${item.task}</td>
                <td>${item.frequency}</td>
                <td>${new Date(item.dueDate).toLocaleDateString('th-TH')}</td>
                <td><span class="badge badge-pill ${getStatusBadgeClass(currentStatus)}">${currentStatus}</span></td>
                <td>${item.assignee}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="window.app.editTask(${item.id})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.app.deleteTask(${item.id})"><i class="bi bi-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
    
    function renderStatusChart() {
        const ctx = document.getElementById('statusChart').getContext('2d');
        let counts = { done: 0, pending: 0, overdue: 0 };
        pmScheduleData.forEach(item => {
            const status = getTaskStatus(item);
            if (status === 'เสร็จสิ้น') counts.done++;
            else if (status === 'เกินกำหนด') counts.overdue++;
            else counts.pending++;
        });
        if (statusChart) statusChart.destroy();
        statusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['เสร็จสิ้น', 'รอดำเนินการ', 'เกินกำหนด'],
                datasets: [{
                    data: [counts.done, counts.pending, counts.overdue],
                    backgroundColor: ['#28a745', '#17a2b8', '#dc3545']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    function updateKpiCards() {
        let dueThisWeek = 0, overdue = 0, dueThisMonth = 0;
        const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        pmScheduleData.forEach(item => {
            const status = getTaskStatus(item);
            const dueDate = new Date(item.dueDate);
            if (status === 'เกินกำหนด') overdue++;
            if (status === 'รอดำเนินการ') {
                if (dueDate <= oneWeekFromNow) dueThisWeek++;
                if (dueDate <= endOfMonth) dueThisMonth++;
            }
        });

        document.getElementById('due-this-week').textContent = dueThisWeek;
        document.getElementById('overdue-tasks').textContent = overdue;
        document.getElementById('due-this-month').textContent = dueThisMonth;
    }

    // --- HELPER FUNCTIONS ---
    function getTaskStatus(item) {
        if (item.status === 'เสร็จสิ้น') return 'เสร็จสิ้น';
        return new Date(item.dueDate) < today ? 'เกินกำหนด' : 'รอดำเนินการ';
    }

    function getStatusBadgeClass(status) {
        if (status === 'เสร็จสิ้น') return 'badge-success';
        if (status === 'เกินกำหนด') return 'badge-danger';
        return 'badge-info';
    }
    
    // --- EVENT LISTENERS & HANDLERS ---
    searchInput.addEventListener('input', renderTable);
    
    addNewTaskBtn.addEventListener('click', () => {
        document.getElementById('taskForm').reset();
        document.getElementById('taskId').value = '';
        document.getElementById('taskModalLabel').textContent = 'เพิ่มใบงานใหม่';
        taskModal.modal('show');
    });

    saveTaskBtn.addEventListener('click', async () => {
        const taskData = {
            machineType: document.getElementById('machineType').value.trim(),
            task: document.getElementById('task').value.trim(),
            frequency: document.getElementById('frequency').value.trim(),
            dueDate: document.getElementById('dueDate').value,
            status: document.getElementById('status').value,
            assignee: document.getElementById('assignee').value.trim(),
        };
        if (!taskData.machineType || !taskData.task || !taskData.dueDate) {
            alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
            return;
        }
        await saveTask(taskData);
        taskModal.modal('hide');
    });

    // --- ATTACH FUNCTIONS TO WINDOW for inline onclick ---
    window.app = {
        editTask: (id) => {
            const task = pmScheduleData.find(t => t.id === id);
            document.getElementById('taskId').value = task.id;
            document.getElementById('machineType').value = task.machineType;
            document.getElementById('task').value = task.task;
            document.getElementById('frequency').value = task.frequency;
            document.getElementById('dueDate').value = task.dueDate;
            document.getElementById('status').value = task.status;
            document.getElementById('assignee').value = task.assignee;
            document.getElementById('taskModalLabel').textContent = 'แก้ไขใบงาน';
            taskModal.modal('show');
        },
        deleteTask: deleteTask
    };

    // --- INITIALIZATION ---
    fetchData();
});
