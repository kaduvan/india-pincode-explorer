/**
 * India Pincode Explorer — Interactive Dashboard
 * Uses Leaflet.js with state-wise GeoJSON loading for performance.
 */

// ===== STATE COLOR PALETTE =====
const STATE_COLORS = [
    '#e6194b','#3cb44b','#ffe119','#4363d8','#f58231','#911eb4','#42d4f4','#f032e6',
    '#bfef45','#fabed4','#469990','#dcbeff','#9A6324','#fffac8','#800000','#aaffc3',
    '#808000','#ffd8b1','#000075','#a9a9a9','#e6beff','#1abc9c','#e74c3c','#3498db',
    '#2ecc71','#f39c12','#8e44ad','#1abc9c','#d35400','#2c3e50','#c0392b','#16a085',
    '#27ae60','#2980b9','#8e44ad','#f1c40f'
];

const OFFICE_TYPE_COLORS = {
    'H.O': '#e74c3c',
    'S.O': '#3498db',
    'B.O': '#2ecc71',
};

// ===== APP STATE =====
const App = {
    map: null,
    geojsonLayer: null,
    metadata: null,
    searchIndex: [],
    currentState: '',
    currentDistrict: '',
    currentOfficeType: '',
    currentColorMode: 'state',
    stateColorMap: {},
    loadedStateFiles: new Set(),
    isLoading: false,
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    initEventListeners();
    await loadMetadata();
    await loadSearchIndex();
    loadAllStates();
});

function initMap() {
    App.map = L.map('map', {
        center: [22.5, 82.0],
        zoom: 5,
        minZoom: 4,
        maxZoom: 14,
        zoomControl: true,
    });

    // Tile layer — CartoDB Voyager for clean look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
    }).addTo(App.map);

    // Scale control
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(App.map);
}

function initEventListeners() {
    // Disclaimer banner dismiss
    document.getElementById('disclaimerClose').addEventListener('click', () => {
        document.getElementById('disclaimerBanner').classList.add('hidden');
        localStorage.setItem('disclaimerDismissed', 'true');
    });
    if (localStorage.getItem('disclaimerDismissed') === 'true') {
        document.getElementById('disclaimerBanner').classList.add('hidden');
    }

    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
        setTimeout(() => App.map.invalidateSize(), 350);
    });

    // Search
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.getElementById('searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Filters
    document.getElementById('stateSelect').addEventListener('change', handleStateChange);
    document.getElementById('districtSelect').addEventListener('change', handleDistrictChange);
    document.getElementById('officeTypeSelect').addEventListener('change', handleOfficeTypeChange);
    document.getElementById('colorMode').addEventListener('change', handleColorModeChange);
    document.getElementById('resetBtn').addEventListener('click', resetFilters);
}

// ===== DATA LOADING =====
async function loadMetadata() {
    try {
        const resp = await fetch('data/metadata.json');
        App.metadata = await resp.json();
        
        // Build state color map
        const states = Object.keys(App.metadata.states).sort();
        states.forEach((state, i) => {
            App.stateColorMap[state] = STATE_COLORS[i % STATE_COLORS.length];
        });

        // Populate state dropdown
        const stateSelect = document.getElementById('stateSelect');
        states.forEach(state => {
            const opt = document.createElement('option');
            opt.value = state;
            opt.textContent = `${state} (${App.metadata.states[state].count})`;
            stateSelect.appendChild(opt);
        });

        // Update header badges
        document.getElementById('totalCount').textContent = App.metadata.total_pincodes.toLocaleString();
        document.getElementById('stateCount').textContent = App.metadata.total_states;
    } catch (err) {
        console.error('Failed to load metadata:', err);
    }
}

async function loadSearchIndex() {
    try {
        const resp = await fetch('data/search_index.csv');
        const text = await resp.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');
        
        App.searchIndex = [];
        for (let i = 1; i < lines.length; i++) {
            const vals = parseCSVLine(lines[i]);
            if (vals.length >= 6) {
                App.searchIndex.push({
                    pincode: vals[0],
                    state: vals[1],
                    district: vals[2],
                    officename: vals[3],
                    officetype: vals[4],
                    lat: parseFloat(vals[5]),
                    lon: parseFloat(vals[6]),
                });
            }
        }
    } catch (err) {
        console.error('Failed to load search index:', err);
    }
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

// ===== MAP RENDERING =====
function showLoading() {
    App.isLoading = true;
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    App.isLoading = false;
    document.getElementById('loadingOverlay').classList.add('hidden');
}

async function loadAllStates() {
    showLoading();
    try {
        if (App.geojsonLayer) {
            App.map.removeLayer(App.geojsonLayer);
        }

        App.geojsonLayer = L.layerGroup().addTo(App.map);
        const states = Object.keys(App.metadata.states).sort();

        // Load all state files in parallel (batched)
        const batchSize = 6;
        for (let i = 0; i < states.length; i += batchSize) {
            const batch = states.slice(i, i + batchSize);
            await Promise.all(batch.map(state => loadStateGeoJSON(state)));
        }

        updateStats();
    } catch (err) {
        console.error('Error loading states:', err);
    } finally {
        hideLoading();
    }
}

async function loadFilteredView() {
    showLoading();
    try {
        if (App.geojsonLayer) {
            App.map.removeLayer(App.geojsonLayer);
        }
        App.geojsonLayer = L.layerGroup().addTo(App.map);

        const state = App.currentState;

        if (state && App.metadata.states[state]) {
            await loadStateGeoJSON(state);
            
            // Fit map to state
            const stateData = App.metadata.states[state];
            // We'll fit bounds after loading
        } else {
            await loadAllStates();
            return;
        }

        updateStats();
    } catch (err) {
        console.error('Error loading filtered view:', err);
    } finally {
        hideLoading();
    }
}

async function loadStateGeoJSON(state) {
    const stateInfo = App.metadata.states[state];
    if (!stateInfo) return;

    try {
        const resp = await fetch(stateInfo.file);
        if (!resp.ok) return;
        const data = await resp.json();

        const layer = L.geoJSON(data, {
            style: (feature) => getFeatureStyle(feature),
            onEachFeature: (feature, layer) => {
                layer.on({
                    click: onFeatureClick,
                    mouseover: onFeatureHover,
                    mouseout: onFeatureOut,
                });
            },
            filter: (feature) => filterFeature(feature),
        });

        App.geojsonLayer.addLayer(layer);

        // If viewing single state, fit bounds
        if (App.currentState === state && !App.currentDistrict) {
            try {
                App.map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 8 });
            } catch (e) { /* bounds may fail on some geometries */ }
        }
    } catch (err) {
        console.error(`Failed to load ${state}:`, err);
    }
}

function filterFeature(feature) {
    const props = feature.properties;
    
    // District filter
    if (App.currentDistrict && props.district !== App.currentDistrict) return false;
    
    // Office type filter
    if (App.currentOfficeType && props.officetype !== App.currentOfficeType) return false;
    
    return true;
}

function getFeatureStyle(feature) {
    const props = feature.properties;
    let fillColor = '#3498db';
    let opacity = 0.6;

    if (App.currentColorMode === 'state') {
        fillColor = App.stateColorMap[props.state] || '#3498db';
    } else if (App.currentColorMode === 'officetype') {
        fillColor = OFFICE_TYPE_COLORS[props.officetype] || '#3498db';
    }

    return {
        fillColor: fillColor,
        weight: 1,
        opacity: 0.8,
        color: '#ffffff',
        fillOpacity: opacity,
    };
}

function highlightStyle() {
    return {
        weight: 3,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.8,
    };
}

// ===== MAP EVENTS =====
function onFeatureClick(e) {
    const layer = e.target;
    const props = layer.feature.properties;

    // Show popup
    const popupContent = `
        <div class="popup-content">
            <h4>${props.pincode}</h4>
            <table>
                <tr><td>Office</td><td>${props.officename}</td></tr>
                <tr><td>Type</td><td>${props.officetype}</td></tr>
                <tr><td>District</td><td>${props.district}</td></tr>
                <tr><td>State</td><td>${props.state}</td></tr>
            </table>
        </div>
    `;
    
    layer.bindPopup(popupContent).openPopup();

    // Show info panel
    showInfoPanel(props);
}

function onFeatureHover(e) {
    const layer = e.target;
    layer.setStyle(highlightStyle());
    layer.bringToFront();
}

function onFeatureOut(e) {
    const layer = e.target;
    layer.setStyle(getFeatureStyle(layer.feature));
}

function showInfoPanel(props) {
    const panel = document.getElementById('infoPanel');
    const content = document.getElementById('infoContent');
    panel.style.display = 'block';
    content.innerHTML = `
        <div class="info-row"><span class="label">Pincode</span><span class="value">${props.pincode}</span></div>
        <div class="info-row"><span class="label">Office</span><span class="value">${props.officename}</span></div>
        <div class="info-row"><span class="label">Type</span><span class="value">${props.officetype}</span></div>
        <div class="info-row"><span class="label">District</span><span class="value">${props.district}</span></div>
        <div class="info-row"><span class="label">State</span><span class="value">${props.state}</span></div>
    `;
}

// ===== FILTER HANDLERS =====
async function handleStateChange(e) {
    App.currentState = e.target.value;
    App.currentDistrict = '';

    const districtSelect = document.getElementById('districtSelect');
    districtSelect.disabled = !App.currentState;
    districtSelect.innerHTML = '<option value="">— All Districts —</option>';

    if (App.currentState) {
        // Populate districts for selected state
        const districts = [...new Set(
            App.searchIndex
                .filter(r => r.state === App.currentState)
                .map(r => r.district)
        )].sort();
        
        districts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            districtSelect.appendChild(opt);
        });

        await loadFilteredView();
    } else {
        await loadAllStates();
        App.map.setView([22.5, 82.0], 5);
    }
}

async function handleDistrictChange(e) {
    App.currentDistrict = e.target.value;
    
    if (App.currentState) {
        await loadFilteredView();
        
        // Try to fit to district bounds
        if (App.currentDistrict && App.geojsonLayer) {
            const districtLayers = [];
            App.geojsonLayer.eachLayer(l => {
                if (l.eachLayer) {
                    l.eachLayer(sub => {
                        if (sub.feature && sub.feature.properties.district === App.currentDistrict) {
                            districtLayers.push(sub);
                        }
                    });
                }
            });
            if (districtLayers.length > 0) {
                const group = L.featureGroup(districtLayers);
                try { App.map.fitBounds(group.getBounds(), { padding: [20, 20], maxZoom: 10 }); } catch(e) {}
            }
        }
    }
}

async function handleOfficeTypeChange(e) {
    App.currentOfficeType = e.target.value;
    if (App.currentState) {
        await loadFilteredView();
    } else {
        await loadAllStates();
    }
}

async function handleColorModeChange(e) {
    App.currentColorMode = e.target.value;
    // Re-style existing layers
    if (App.geojsonLayer) {
        App.geojsonLayer.eachLayer(l => {
            if (l.eachLayer) {
                l.eachLayer(sub => {
                    if (sub.feature) {
                        sub.setStyle(getFeatureStyle(sub.feature));
                    }
                });
            }
        });
    }
}

async function resetFilters() {
    App.currentState = '';
    App.currentDistrict = '';
    App.currentOfficeType = '';

    document.getElementById('stateSelect').value = '';
    document.getElementById('districtSelect').value = '';
    document.getElementById('districtSelect').disabled = true;
    document.getElementById('districtSelect').innerHTML = '<option value="">— Select State First —</option>';
    document.getElementById('officeTypeSelect').value = '';
    document.getElementById('infoPanel').style.display = 'none';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';

    await loadAllStates();
    App.map.setView([22.5, 82.0], 5);
}

// ===== SEARCH =====
function handleSearch() {
    const query = document.getElementById('searchInput').value.trim();
    const resultsDiv = document.getElementById('searchResults');
    
    if (!query || query.length < 3) {
        resultsDiv.innerHTML = '<div class="search-result-item" style="color:var(--text-secondary)">Enter at least 3 digits</div>';
        return;
    }

    // Search by pincode prefix
    const matches = App.searchIndex.filter(r => r.pincode.startsWith(query));
    
    if (matches.length === 0) {
        resultsDiv.innerHTML = '<div class="search-result-item" style="color:var(--text-secondary)">No results found</div>';
        return;
    }

    const display = matches.slice(0, 20);
    resultsDiv.innerHTML = display.map(r => `
        <div class="search-result-item" data-lat="${r.lat}" data-lon="${r.lon}" data-pincode="${r.pincode}" onclick="flyToResult(this)">
            <div class="pincode">${r.pincode}</div>
            <div class="details">${r.officename} · ${r.officetype} · ${r.district}, ${r.state}</div>
        </div>
    `).join('') + (matches.length > 20 ? `<div class="search-result-item" style="color:var(--text-secondary)">...and ${matches.length - 20} more</div>` : '');
}

function flyToResult(el) {
    const lat = parseFloat(el.dataset.lat);
    const lon = parseFloat(el.dataset.lon);
    const pincode = el.dataset.pincode;
    
    App.map.flyTo([lat, lon], 12, { duration: 1.5 });
    
    // Try to find and highlight the matching feature
    setTimeout(() => {
        if (App.geojsonLayer) {
            App.geojsonLayer.eachLayer(l => {
                if (l.eachLayer) {
                    l.eachLayer(sub => {
                        if (sub.feature && sub.feature.properties.pincode === pincode) {
                            sub.setStyle({
                                weight: 4,
                                opacity: 1,
                                color: '#ff0000',
                                fillOpacity: 0.8,
                            });
                            sub.bringToFront();
                            sub.fire('click');
                        }
                    });
                }
            });
        }
    }, 1600);
}

// ===== STATS =====
function updateStats() {
    let visible = 0;
    let ho = 0, so = 0, bo = 0;

    if (App.geojsonLayer) {
        App.geojsonLayer.eachLayer(l => {
            if (l.eachLayer) {
                l.eachLayer(sub => {
                    if (sub.feature) {
                        visible++;
                        const t = sub.feature.properties.officetype;
                        if (t === 'H.O') ho++;
                        else if (t === 'S.O') so++;
                        else if (t === 'B.O') bo++;
                    }
                });
            }
        });
    }

    document.getElementById('visibleCount').textContent = visible.toLocaleString();
    document.getElementById('hoCount').textContent = ho.toLocaleString();
    document.getElementById('soCount').textContent = so.toLocaleString();
    document.getElementById('boCount').textContent = bo.toLocaleString();
}
