// استبدل هذا الرابط بالـ URL الخاص بـ API الرئيسي لجدول بيانات المهام من SheetDB.io
const SHEETDB_MAIN_API_URL = 'https://sheetdb.io/api/v1/gv7yywbjg53qh';

// الحصول على عناصر DOM
const messageDiv = document.getElementById('message');
const employeeTasksTablesContainer = document.getElementById('employeeTasksTablesContainer');
const monthFilter = document.getElementById('monthFilter');
const dayOfWeekFilter = document.getElementById('dayOfWeekFilter');
const tasksTableBody = document.getElementById('tasksTableBody'); // للحصول على جسم الجدول الرئيسي

// متغيرات لحفظ مثيلات الرسوم البيانية لتجنب إعادة إنشائها
let statusChartInstance = null;
let employeeChartInstance = null;
let typeChartInstance = null;
let mostCommonTasksChartInstance = null;
let dayOfWeekChartInstance = null;
let quantityChartInstance = null;

// --- وظائف مساعدة ---

// دالة لتدمير الرسوم البيانية الموجودة قبل رسم رسوم بيانية جديدة
function destroyCharts() {
    if (statusChartInstance) { statusChartInstance.destroy(); statusChartInstance = null; }
    if (employeeChartInstance) { employeeChartInstance.destroy(); employeeChartInstance = null; }
    if (typeChartInstance) { typeChartInstance.destroy(); typeChartInstance = null; }
    if (mostCommonTasksChartInstance) { mostCommonTasksChartInstance.destroy(); mostCommonTasksChartInstance = null; }
    if (dayOfWeekChartInstance) { dayOfWeekChartInstance.destroy(); dayOfWeekChartInstance = null; }
    if (quantityChartInstance) { quantityChartInstance.destroy(); quantityChartInstance = null; }
}

// دالة مساعدة لعد تكرار القيم في مصفوفة
function countOccurrences(arr) {
    return arr.reduce((acc, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
    }, {});
}

// --- الوظيفة الرئيسية لجلب وعرض البيانات ---

async function fetchAndDisplayTasks() {
    messageDiv.textContent = 'جاري تحميل البيانات...';
    messageDiv.className = 'loading-message';
    destroyCharts(); // تدمير الرسوم البيانية القديمة
    employeeTasksTablesContainer.innerHTML = ''; // مسح الجداول القديمة للموظفين
    tasksTableBody.innerHTML = ''; // مسح الجدول الرئيسي أيضًا

    try {
        const response = await fetch(SHEETDB_MAIN_API_URL);

        if (!response.ok) {
            throw new Error(`خطأ في الشبكة أو الخادم: ${response.status} ${response.statusText}`);
        }

        const allTasks = await response.json(); // جلب جميع المهام

        // --- تطبيق التصفية حسب الشهر ويوم الأسبوع ---
        const selectedMonth = monthFilter.value;
        const selectedDayOfWeek = dayOfWeekFilter.value;

        let filteredTasks = allTasks;

        // تصفية حسب الشهر
        if (selectedMonth) {
            filteredTasks = filteredTasks.filter(task => {
                // التأكد أن 'التاريخ' موجود وصحيح قبل التحويل
                if (!task.التاريخ) return false;
                const taskDate = new Date(task.التاريخ);
                // getMonth() ترجع 0 لشهر يناير، لذا نضيف 1
                return taskDate.getMonth() + 1 === parseInt(selectedMonth);
            });
        }

        // تصفية حسب يوم الأسبوع
        if (selectedDayOfWeek) {
            filteredTasks = filteredTasks.filter(task => {
                return task['يوم الأسبوع'] === selectedDayOfWeek;
            });
        }
        // ---------------------------------------------

        messageDiv.textContent = ''; // مسح رسالة التحميل
        messageDiv.className = ''; // مسح فئة التحميل

        if (filteredTasks.length === 0) {
            employeeTasksTablesContainer.innerHTML = '<p style="text-align: center; margin-top: 30px;">لا توجد مهام مسجلة حاليًا حسب الفلاتر المختارة.</p>';
            tasksTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">لا توجد مهام مسجلة حاليًا حسب الفلاتر المختارة.</td></tr>';
            return; // توقف هنا إذا لم تكن هناك مهام بعد التصفية
        }

        // --- عرض البيانات في الجدول الرئيسي ---
        filteredTasks.forEach(task => {
            const row = document.createElement('tr');
            // تذكر أن أسماء الأعمدة هنا يجب أن تطابق أسماء الأعمدة في Google Sheet بالضبط.
            row.innerHTML = `
                <td>${task.التاريخ || ''}</td>
                <td>${task['يوم الأسبوع'] || ''}</td>
                <td>${task['نوع المهمة'] || ''}</td>
                <td>${task.المهمة || ''}</td>
                <td>${task.الحالة || ''}</td>
                <td>${task.ملاحظات || ''}</td>
                <td>${task.الموظف || ''}</td>
            `;
            tasksTableBody.appendChild(row);
        });

        // --- إنشاء الرسوم البيانية ---
        generateCharts(filteredTasks); // نستخدم المهام المفلترة هنا

        // --- عرض المهام حسب الموظف في جداول منفصلة ---
        displayTasksByEmployee(filteredTasks); // نستخدم المهام المفلترة هنا

    } catch (error) {
        console.error('حدث خطأ أثناء جلب المهام:', error);
        messageDiv.textContent = `حدث خطأ في تحميل المهام: ${error.message}`;
        messageDiv.className = 'error-message';
        employeeTasksTablesContainer.innerHTML = '<p style="text-align: center; color: red; margin-top: 30px;">فشل تحميل المهام. الرجاء التأكد من اتصال الإنترنت وإعدادات SheetDB.</p>';
        tasksTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">فشل تحميل المهام.</td></tr>';
    }
}

// --- دالة إنشاء الرسوم البيانية ---
// هذه الدالة لا تزال موجودة لعرض الرسوم البيانية في الصفحة، لكن لن يتم تصديرها إلى PDF.
function generateCharts(tasks) {
    const defaultColors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#fd7e14', '#e83e8c', '#6c757d'];

    // 1. المهام حسب الحالة (دائرية)
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    const statusCounts = countOccurrences(tasks.map(t => t.الحالة).filter(Boolean));
    const statusLabels = Object.keys(statusCounts);
    const statusData = Object.values(statusCounts);
    const statusBackgroundColors = statusLabels.map((_, i) => defaultColors[i % defaultColors.length]);
    statusChartInstance = new Chart(statusCtx, {
        type: 'pie',
        data: { labels: statusLabels, datasets: [{ data: statusData, backgroundColor: statusBackgroundColors }] },
        options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: false } } }
    });

    // 2. المهام حسب الموظف (شريطية)
    const employeeCtx = document.getElementById('employeeChart').getContext('2d');
    const employeeCounts = countOccurrences(tasks.map(t => t.الموظف).filter(Boolean));
    const employeeLabels = Object.keys(employeeCounts);
    const employeeData = Object.values(employeeCounts);
    const employeeBackgroundColors = employeeLabels.map((_, i) => defaultColors[i % defaultColors.length]);
    employeeChartInstance = new Chart(employeeCtx, {
        type: 'bar',
        data: { labels: employeeLabels, datasets: [{ label: 'عدد المهام', data: employeeData, backgroundColor: employeeBackgroundColors, borderWidth: 1 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'عدد المهام' } } } }
    });

    // 3. المهام حسب النوع (دائرية)
    const typeCtx = document.getElementById('typeChart').getContext('2d');
    const typeCounts = countOccurrences(tasks.map(t => t['نوع المهمة']).filter(Boolean));
    const typeLabels = Object.keys(typeCounts);
    const typeData = Object.values(typeCounts);
    const typeBackgroundColors = typeLabels.map((_, i) => defaultColors[i % defaultColors.length]);
    typeChartInstance = new Chart(typeCtx, {
        type: 'doughnut',
        data: { labels: typeLabels, datasets: [{ data: typeData, backgroundColor: typeBackgroundColors }] },
        options: { responsive: true, plugins: { legend: { position: 'top' }, title: { display: false } } }
    });

    // 4. أكثر المهام شيوعًا (شريطية أفقية)
    const mostCommonTasksCtx = document.getElementById('mostCommonTasksChart').getContext('2d');
    const specificTaskCounts = countOccurrences(tasks.map(t => t.المهمة).filter(Boolean));
    const sortedTasks = Object.entries(specificTaskCounts).sort(([,a],[,b]) => b - a);
    const topTasks = sortedTasks.slice(0, 5); // عرض أكثر 5 مهام
    const topTaskLabels = topTasks.map(entry => entry[0]);
    const topTaskData = topTasks.map(entry => entry[1]);
    mostCommonTasksChartInstance = new Chart(mostCommonTasksCtx, {
        type: 'bar',
        data: { labels: topTaskLabels, datasets: [{ label: 'تكرار المهمة', data: topTaskData, backgroundColor: '#6f42c1', borderWidth: 1 }] },
        options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, title: { display: true, text: 'عدد مرات التكرار' } } } }
    });

    // 5. المهام حسب يوم الأسبوع (شريطية) - فقط للمهام اليومية
    const dayOfWeekCtx = document.getElementById('dayOfWeekChart').getContext('2d');
    const dailyTasksByDay = tasks.filter(t => t['نوع المهمة'] === 'يومية' && t['يوم الأسبوع']).map(t => t['يوم الأسبوع']);
    const dayOfWeekOrder = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']; // ترتيب الأيام
    const dayOfWeekCounts = countOccurrences(dailyTasksByDay);
    const orderedDayOfWeekLabels = dayOfWeekOrder.filter(day => dayOfWeekCounts[day]); // فلترة الأيام الموجودة فقط
    const orderedDayOfWeekData = orderedDayOfWeekLabels.map(day => dayOfWeekCounts[day]);
    dayOfWeekChartInstance = new Chart(dayOfWeekCtx, {
        type: 'bar',
        data: { labels: orderedDayOfWeekLabels, datasets: [{ label: 'عدد المهام اليومية', data: orderedDayOfWeekData, backgroundColor: '#fd7e14', borderWidth: 1 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'عدد المهام' } } } }
    });
    
    // 6. إجمالي الكميات المنجزة (للمهام ذات الكمية) - باستخدام حقل الملاحظات كرقم
    const quantityCtx = document.getElementById('quantityChart').getContext('2d');
    const quantityData = {};
    tasks.forEach(task => {
        const taskName = task.المهمة;
        // حاول تحويل الملاحظات إلى رقم، وتأكد من أنها ليست NaN
        const notes = parseFloat(task.ملاحظات); 
        if (taskName && !isNaN(notes)) { // إذا كانت المهمة موجودة والملاحظات رقمًا
            quantityData[taskName] = (quantityData[taskName] || 0) + notes;
        }
    });
    const quantityLabels = Object.keys(quantityData);
    const quantityValues = Object.values(quantityData);
    const quantityColors = quantityLabels.map((_, i) => defaultColors[i % defaultColors.length]);
    quantityChartInstance = new Chart(quantityCtx, {
        type: 'bar',
        data: {
            labels: quantityLabels,
            datasets: [{
                label: 'إجمالي الكمية المنجزة',
                data: quantityValues,
                backgroundColor: quantityColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'إجمالي الكمية'
                    }
                }
            }
        }
    });
}

// --- دالة عرض المهام مجمعة حسب الموظف ---
function displayTasksByEmployee(tasks) {
    const groupedTasks = tasks.reduce((acc, task) => {
        const employeeName = task.الموظف || 'غير محدد';
        if (!acc[employeeName]) {
            acc[employeeName] = [];
        }
        acc[employeeName].push(task);
        return acc;
    }, {});

    employeeTasksTablesContainer.innerHTML = ''; // مسح أي جداول سابقة

    for (const employeeName in groupedTasks) {
        const employeeTasks = groupedTasks[employeeName];

        const employeeTableContainer = document.createElement('div');
        employeeTableContainer.className = 'employee-table-container';

        const employeeTitle = document.createElement('h3');
        employeeTitle.textContent = `مهام الموظف: ${employeeName}`;
        employeeTableContainer.appendChild(employeeTitle);

        const table = document.createElement('table');
        table.className = 'employee-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>التاريخ</th>
                    <th>يوم الأسبوع</th>
                    <th>نوع المهمة</th>
                    <th>المهمة</th>
                    <th>الحالة</th>
                    <th>ملاحظات</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;

        const tbody = table.querySelector('tbody');
        employeeTasks.forEach(task => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${task.التاريخ || ''}</td>
                <td>${task['يوم الأسبوع'] || ''}</td>
                <td>${task['نوع المهمة'] || ''}</td>
                <td>${task.المهمة || ''}</td>
                <td>${task.الحالة || ''}</td>
                <td>${task.ملاحظات || ''}</td>
            `;
            tbody.appendChild(row);
        });

        employeeTableContainer.appendChild(table);
        employeeTasksTablesContainer.appendChild(employeeTableContainer);
    }
}

// --- دالة تصدير التقرير كـ PDF (معدلة لتصدير الجداول فقط) ---
function generatePdf() {
    // تحديد القسم الذي يحتوي على الجداول فقط
    const elementToPrint = document.getElementById('printableContent'); 

    const options = {
        margin: [10, 10, 10, 10], 
        filename: 'تقرير_المهام_الجداول.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            logging: true, 
            dpi: 192, 
            letterRendering: true, 
            useCORS: true // لا يضر وجودها، ولكن allowTaint لم تعد ضرورية هنا
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    messageDiv.textContent = 'جاري إنشاء ملف PDF للجداول...';
    messageDiv.className = 'loading-message';

    html2pdf().from(elementToPrint).set(options).save().then(() => {
        messageDiv.textContent = 'تم إنشاء ملف PDF للجداول بنجاح!';
        messageDiv.className = 'success-message';
        setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = '';
        }, 3000);
    }).catch(error => {
        console.error('حدث خطأ أثناء إنشاء ملف PDF للجداول:', error);
        messageDiv.textContent = `فشل إنشاء ملف PDF للجداول: ${error.message}.`;
        messageDiv.className = 'error-message';
    });
}

// --- استدعاء الوظيفة الرئيسية عند تحميل الصفحة ---
document.addEventListener('DOMContentLoaded', fetchAndDisplayTasks);