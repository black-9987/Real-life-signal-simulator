// Simulation Constants
const POINTS = 1500;
const TIME_SPAN = 2.5; // seconds
let time = [];
for (let i = 0; i < POINTS; i++) {
    time.push(i * TIME_SPAN / POINTS);
}

// App State
let state = {
    ac: 1.0,
    am: 0.5,
    fc: 20,
    fm: 2,
    isPlaying: false,
    timeOffset: 0,
    isDark: true
};

// DOM Elements
const els = {
    ac: document.getElementById('ac'),
    am: document.getElementById('am'),
    fc: document.getElementById('fc'),
    fm: document.getElementById('fm'),
    acVal: document.getElementById('ac-val'),
    amVal: document.getElementById('am-val'),
    fcVal: document.getElementById('fc-val'),
    fmVal: document.getElementById('fm-val'),
    muDisplay: document.getElementById('mu-display'),
    muStatus: document.getElementById('mu-status'),
    muBar: document.getElementById('mu-bar'),
    playBtn: document.getElementById('play-pause'),
    resetBtn: document.getElementById('reset'),
    themeToggle: document.querySelector('.theme-toggle')
};

function getColors() {
    const root = getComputedStyle(document.documentElement);
    return {
        text: root.getPropertyValue('--text-muted').trim(),
        grid: root.getPropertyValue('--grid-color').trim(),
        msg: root.getPropertyValue('--color-msg').trim(),
        car: root.getPropertyValue('--color-car').trim(),
        am: root.getPropertyValue('--color-am').trim(),
        env: root.getPropertyValue('--color-env').trim()
    };
}

function getPlotLayout(yRange, showLegend = false) {
    const c = getColors();
    return {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: c.text, family: 'Inter, sans-serif', size: 11 },
        margin: { t: 10, r: 20, b: 35, l: 45 },
        xaxis: { 
            showgrid: true, 
            gridcolor: c.grid, 
            zeroline: true, 
            zerolinecolor: c.grid,
            zerolinewidth: 2,
            title: { text: 'Time (s)', font: { size: 11, color: c.text }, standoff: 5 },
            fixedrange: true
        },
        yaxis: { 
            showgrid: true, 
            gridcolor: c.grid, 
            zeroline: true, 
            zerolinecolor: c.grid,
            zerolinewidth: 2,
            title: { text: 'Amplitude (V)', font: { size: 11, color: c.text }, standoff: 5 },
            fixedrange: true,
            range: yRange
        },
        showlegend: showLegend,
        legend: {
            orientation: 'h',
            y: 1.05,
            x: 0.5,
            xanchor: 'center',
            bgcolor: 'rgba(0,0,0,0)'
        },
        hovermode: 'closest'
    };
}

const plotConfig = { displayModeBar: false, responsive: true };

function initPlots() {
    const c = getColors();
    
    // Message Plot
    Plotly.newPlot('message-plot', [{
        x: time, y: [], type: 'scatter', mode: 'lines',
        line: { color: c.msg, width: 2.5, shape: 'spline' },
        name: 'm(t)'
    }], getPlotLayout([-6, 6]), plotConfig);

    // Carrier Plot
    Plotly.newPlot('carrier-plot', [{
        x: time, y: [], type: 'scatter', mode: 'lines',
        line: { color: c.car, width: 1.5, shape: 'spline' },
        name: 'c(t)'
    }], getPlotLayout([-6, 6]), plotConfig);

    // AM Plot
    Plotly.newPlot('am-plot', [
        { // Modulated Signal
            x: time, y: [], type: 'scatter', mode: 'lines',
            line: { color: c.am, width: 1.5, shape: 'spline' },
            name: 's(t)'
        },
        { // Top Envelope
            x: time, y: [], type: 'scatter', mode: 'lines',
            line: { color: c.env, width: 2, dash: 'dash', shape: 'spline' },
            name: 'Envelope'
        },
        { // Bottom Envelope
            x: time, y: [], type: 'scatter', mode: 'lines',
            line: { color: c.env, width: 2, dash: 'dash', shape: 'spline' },
            showlegend: false
        }
    ], getPlotLayout([-11, 11], true), plotConfig);
}

function updateCalculations() {
    const mu = state.am / state.ac;
    els.muDisplay.textContent = mu.toFixed(2);
    
    // Animate numbers and colors based on mu
    els.muStatus.className = 'mu-status';
    
    let barColor = 'var(--success)';
    let barWidth = Math.min(mu * 50, 100); // 1.0 -> 50% width

    if (mu < 1) {
        els.muStatus.textContent = 'Under-modulated';
        els.muStatus.classList.add('status-under');
        els.muDisplay.style.color = 'var(--success)';
    } else if (Math.abs(mu - 1) < 0.01) {
        els.muStatus.textContent = 'Critically modulated';
        els.muStatus.classList.add('status-critical');
        els.muDisplay.style.color = 'var(--warning)';
        barColor = 'var(--warning)';
    } else {
        els.muStatus.textContent = 'Over-modulated';
        els.muStatus.classList.add('status-over');
        els.muDisplay.style.color = 'var(--danger)';
        barColor = 'var(--danger)';
        barWidth = Math.min(50 + (mu - 1) * 25, 100); // Exceed 50%
    }
    
    els.muBar.style.width = `${barWidth}%`;
    els.muBar.style.backgroundColor = barColor;
}

function generateSignals() {
    const msg = new Float32Array(POINTS);
    const car = new Float32Array(POINTS);
    const am = new Float32Array(POINTS);
    const envPos = new Float32Array(POINTS);
    const envNeg = new Float32Array(POINTS);
    
    const w_m = 2 * Math.PI * state.fm;
    const w_c = 2 * Math.PI * state.fc;

    for (let i = 0; i < POINTS; i++) {
        // Shift time for animation
        const t = time[i] + state.timeOffset;
        
        const m_t = state.am * Math.sin(w_m * t);
        const c_t = state.ac * Math.sin(w_c * t);
        const envelope = state.ac + m_t;
        
        msg[i] = m_t;
        car[i] = c_t;
        am[i] = envelope * Math.sin(w_c * t);
        envPos[i] = envelope;
        envNeg[i] = -envelope;
    }
    
    return { msg, car, am, envPos, envNeg };
}

function updatePlots() {
    const sigs = generateSignals();
    
    Plotly.restyle('message-plot', { y: [sigs.msg] });
    Plotly.restyle('carrier-plot', { y: [sigs.car] });
    Plotly.restyle('am-plot', { y: [sigs.am, sigs.envPos, sigs.envNeg] });
}

function updateAll() {
    updateCalculations();
    updatePlots();
}

// Event Listeners
function handleSliderChange(e) {
    const id = e.target.id;
    const val = parseFloat(e.target.value);
    state[id] = val;
    els[`${id}Val`].textContent = val.toFixed(id === 'fc' ? 0 : 1);
    updateAll();
}

['ac', 'am', 'fc', 'fm'].forEach(id => {
    els[id].addEventListener('input', handleSliderChange);
});

// Animation Loop
let animationId;
let lastTimestamp = 0;

function animate(timestamp) {
    if (!state.isPlaying) return;
    
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    
    // Smooth scrolling effect
    state.timeOffset += delta * 0.001; 
    
    updatePlots();
    lastTimestamp = timestamp;
    animationId = requestAnimationFrame(animate);
}

function togglePlay() {
    state.isPlaying = !state.isPlaying;
    if (state.isPlaying) {
        els.playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        els.playBtn.classList.add('playing');
        lastTimestamp = 0;
        animationId = requestAnimationFrame(animate);
    } else {
        els.playBtn.innerHTML = '<i class="fa-solid fa-play"></i> Play';
        els.playBtn.classList.remove('playing');
        cancelAnimationFrame(animationId);
    }
}

els.playBtn.addEventListener('click', togglePlay);

els.resetBtn.addEventListener('click', () => {
    state = { ...state, ac: 1.0, am: 0.5, fc: 20, fm: 2, timeOffset: 0 };
    
    ['ac', 'am', 'fc', 'fm'].forEach(id => {
        els[id].value = state[id];
        els[`${id}Val`].textContent = state[id].toFixed(id === 'fc' ? 0 : 1);
    });
    
    if (state.isPlaying) {
        togglePlay();
    }
    
    updateAll();
});

// Theme Toggle
els.themeToggle.addEventListener('click', () => {
    state.isDark = !state.isDark;
    document.documentElement.setAttribute('data-theme', state.isDark ? 'dark' : 'light');
    els.themeToggle.innerHTML = state.isDark ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    
    // Update plot layouts for theme
    const layoutConfig = {
        'message-plot': [-6, 6],
        'carrier-plot': [-6, 6],
        'am-plot': [-11, 11]
    };
    
    for (const [plotId, range] of Object.entries(layoutConfig)) {
        Plotly.relayout(plotId, getPlotLayout(range, plotId === 'am-plot'));
    }
});

// Initial Setup
setTimeout(() => {
    initPlots();
    updateAll();
}, 100); // Small delay to ensure styles are computed

// Handle Resize
window.addEventListener('resize', () => {
    ['message-plot', 'carrier-plot', 'am-plot'].forEach(id => {
        Plotly.Plots.resize(id);
    });
});
