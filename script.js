/**
 * CORE CONFIGURATION
 */
const SPREADSHEET_ID = '1XLVgnC9rW_bKagsc_fB-HOGB52Kbj4WD7qM3b3sq1lw';

// Global cache variable to support instant local rendering filtering
let localProjectsCache = [];

async function getGoogleSheetData(sheetName) {
    const endpoint = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(endpoint);
    const textData = await response.text();
    
    const openingBraceIndex = textData.indexOf('{');
    const closingBraceIndex = textData.lastIndexOf('}');
    const pureJsonString = textData.substring(openingBraceIndex, closingBraceIndex + 1);
    const parsedData = JSON.parse(pureJsonString);
    
    return parsedData.table.rows.map(row => 
        row.c.map(cell => cell ? cell.v : '')
    );
}

async function initializePortfolio() {
    try {
        // --- PIPELINE 1: FETCH PROJECTS & SETUP FILTER ENGINE ---
        const rawProjects = await getGoogleSheetData('Projects');
        
        // Map raw data and populate the cache array
        localProjectsCache = rawProjects.slice(1).map(row => {
            const [title, context, imageUrl, pdfUrl, sourceCodeUrl, demoUrl, type] = row;
            return {
                title: title || '',
                context: context || '',
                imageUrl: imageUrl || '',
                pdfUrl: pdfUrl || '',
                sourceCodeUrl: sourceCodeUrl || '',
                demoUrl: demoUrl || '',
                type: type ? type.toLowerCase().trim() : 'other' // Default to other if column is unpopulated
            };
        }).filter(proj => proj.title !== ''); // Drop incomplete artifact blocks

        // Perform initial rendering loadout for all projects
        renderProjectGrid(localProjectsCache);
        setupFilterTabsEventListeners();

        // --- PIPELINE 2: FETCH & CATEGORIZE CERTIFICATES ---
        const rawCertificates = await getGoogleSheetData('Certificates');
        const categorizedCertificates = { degree: [], language: [], specialized: [], other: [] };

        rawCertificates.forEach((row, index) => {
            if (index === 0) return; 
            const [category, name, issuer] = row;
            if (!name) return;

            const token = category ? category.toLowerCase().trim() : '';
            if (token.includes('deg')) categorizedCertificates.degree.push({ name, issuer });
            else if (token.includes('lan')) categorizedCertificates.language.push({ name, issuer });
            else if (token.includes('spec')) categorizedCertificates.specialized.push({ name, issuer });
            else categorizedCertificates.other.push({ name, issuer });
        });

        renderCertificateColumn('cert-degree', 'col-degree', categorizedCertificates.degree);
        renderCertificateColumn('cert-language', 'col-language', categorizedCertificates.language);
        renderCertificateColumn('cert-specialized', 'col-specialized', categorizedCertificates.specialized);
        renderCertificateColumn('cert-other', 'col-other', categorizedCertificates.other);

    } catch (pipelineError) {
        console.error('Critical Portfolio Pipeline Error:', pipelineError);
    }
}

/**
 * Pure rendering block responsible for wiping and re-populating the UI project grid
 */
function renderProjectGrid(projectsToRender) {
    const projectsContainer = document.getElementById('projects-container');
    projectsContainer.innerHTML = ''; // Wipe out existing layouts entirely

    projectsToRender.forEach(project => {
        const projectCard = document.createElement('div');
        projectCard.className = 'card project-card animated-fade-in';
        projectCard.innerHTML = `
            <img src="${project.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600'}" alt="${project.title}" class="project-img" loading="lazy">
            <div class="project-title-bar">${project.title}</div>
        `;
        
        projectCard.addEventListener('click', () => triggerModalDisplay(project));
        projectsContainer.appendChild(projectCard);
    });
}

/**
 * Binds clicking listeners to tabs and handles mathematical filtering logic
 */
function setupFilterTabsEventListeners() {
    const tabs = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active style state token across alternate nodes
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const filterCriterion = tab.getAttribute('data-filter');
            
            if (filterCriterion === 'all') {
                renderProjectGrid(localProjectsCache);
            } else {
                const filteredSubset = localProjectsCache.filter(p => p.type === filterCriterion);
                renderProjectGrid(filteredSubset);
            }
        });
    });
}

function renderCertificateColumn(ulElementId, structuralColumnId, structuralDataset) {
    const listContainer = document.getElementById(ulElementId);
    const parentColumnCard = document.getElementById(structuralColumnId);
    const VISIBILITY_THRESHOLD = 3;

    structuralDataset.forEach((item, index) => {
        const listItem = document.createElement('li');
        if (index >= VISIBILITY_THRESHOLD) listItem.className = 'hidden-cert'; 
        listItem.innerHTML = `<strong>${item.name}</strong> <span class="cert-issuer">${item.issuer || ''}</span>`;
        listContainer.appendChild(listItem);
    });

    if (structuralDataset.length > VISIBILITY_THRESHOLD) {
        const toggleButton = document.createElement('button');
        toggleButton.className = 'btn-more';
        toggleButton.innerHTML = `Show More <span class="material-symbols-outlined">expand_more</span>`;
        
       toggleButton.addEventListener('click', () => {
            const hiddenTargetElements = listContainer.querySelectorAll('.hidden-cert');
            const isCurrentlyExpanded = toggleButton.classList.contains('expanded');

            if (isCurrentlyExpanded) {
                // Đang trạng thái mở -> Click vào để THU GỌN lại
                hiddenTargetElements.forEach(li => { li.style.display = 'none'; });
                toggleButton.innerHTML = `Show More <span class="material-symbols-outlined">expand_more</span>`;
                toggleButton.classList.remove('expanded');
            } else {
                // Đang trạng thái đóng -> Click vào để MỞ RỘNG ra
                hiddenTargetElements.forEach(li => { li.style.display = 'block'; });
                toggleButton.innerHTML = `Show Less <span class="material-symbols-outlined">expand_less</span>`;
                toggleButton.classList.add('expanded');
            }
        });
        parentColumnCard.appendChild(toggleButton);
    }
}

// --- MODAL POPUP ENGINE ---
const modalOverlayElement = document.getElementById('project-modal');
const modalCloseTrigger = document.querySelector('.close-btn');

function triggerModalDisplay(projectContextObject) {
    document.getElementById('modal-title').textContent = projectContextObject.title;
    document.getElementById('modal-context').textContent = projectContextObject.context || 'Detailed case study and documentation is currently being compiled.';
    document.getElementById('modal-img').src = projectContextObject.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600';
    
    bindModalActionLink('modal-pdf', projectContextObject.pdfUrl);
    bindModalActionLink('modal-source', projectContextObject.sourceCodeUrl);
    bindModalActionLink('modal-demo', projectContextObject.demoUrl);

    modalOverlayElement.classList.add('show');
}

function bindModalActionLink(domElementId, destinationUrl) {
    const hyperLinkElement = document.getElementById(domElementId);
    if (destinationUrl && destinationUrl.toString().trim().startsWith('http')) {
        hyperLinkElement.href = destinationUrl;
        hyperLinkElement.style.display = 'inline-flex';
    } else {
        hyperLinkElement.style.display = 'none'; 
    }
}

modalCloseTrigger.addEventListener('click', () => modalOverlayElement.classList.remove('show'));
window.addEventListener('click', (windowEvent) => { 
    if (windowEvent.target === modalOverlayElement) modalOverlayElement.classList.remove('show'); 
});

document.addEventListener('DOMContentLoaded', initializePortfolio);