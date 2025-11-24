document.addEventListener('DOMContentLoaded', function() {
    const audioEl = document.getElementById('audioElement');
    const playBtn = document.getElementById('playBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const trackButtons = Array.from(document.querySelectorAll('.track-button'));
    const overlay = document.getElementById('overlayPlay');
    const trackTitle = document.getElementById('trackTitle');
    const trackTime = document.getElementById('trackTime');
    const cassette = document.querySelector('.cassette-player');

    const tracks = [
        {src: 'audio/track1.mp3', title: 'Sartenazos desde Plutón'},
        {src: 'audio/track2.mp3', title: 'Gobierno de la IA'}
    ];

    let current = 0;
    let isPlaying = false;
    let rafId = null;

    function loadTrack(i){
        current = i % tracks.length;
        audioEl.src = tracks[current].src;
        trackTitle.textContent = tracks[current].title || `Track ${current+1}`;
        trackButtons.forEach(b=>b.classList.toggle('active', Number(b.dataset.index)===current));
    }

    function updateTime(){
        const cur = formatTime(audioEl.currentTime);
        const dur = isFinite(audioEl.duration) ? formatTime(audioEl.duration) : '00:00';
        trackTime.textContent = `${cur} / ${dur}`;
    }

    function formatTime(s){
        if (!isFinite(s)) return '00:00';
        const m = Math.floor(s/60).toString().padStart(2,'0');
        const sec = Math.floor(s%60).toString().padStart(2,'0');
        return `${m}:${sec}`;
    }

    function play(){
        audioEl.play().then(()=>{
            isPlaying = true;
            playBtn.textContent = '▮▮';
            cassette.classList.add('playing');
            overlay.hidden = true;
            startSpoolAnimation();
        }).catch(()=>{
            // Autoplay blocked — show overlay to prompt user
            overlay.hidden = false;
        });
    }

    function pause(){
        audioEl.pause();
        isPlaying = false;
        playBtn.textContent = '▶';
        cassette.classList.remove('playing');
        stopSpoolAnimation();
    }

    function togglePlay(){
        isPlaying ? pause() : play();
    }

    // controls
    playBtn.addEventListener('click', ()=>{ togglePlay(); overlay.hidden = true; });
    prevBtn.addEventListener('click', ()=>{ loadTrack((current-1+tracks.length)%tracks.length); play(); });
    nextBtn.addEventListener('click', ()=>{ loadTrack((current+1)%tracks.length); play(); });

    trackButtons.forEach(btn=>{
        btn.addEventListener('click', ()=>{ loadTrack(Number(btn.dataset.index)); play(); });
    });

    audioEl.addEventListener('timeupdate', updateTime);
    audioEl.addEventListener('ended', ()=>{
        loadTrack((current+1)%tracks.length);
        play();
    });

    overlay.addEventListener('click', ()=>{ play(); });

    // URL params handling: ?autoplay=1&track=2
    const params = new URLSearchParams(location.search);
    const wantAutoplay = params.get('autoplay') === '1' || params.get('autoplay') === 'true';
    const trackParam = parseInt(params.get('track')) || null;

    if (trackParam && trackParam>=1 && trackParam<=tracks.length) loadTrack(trackParam-1);
    else loadTrack(0);

    // Try autoplay if requested
    if (wantAutoplay){
        // some browsers require user gesture — attempt and fall back to overlay
        play();
    }

    // Spool / tape animation handled with requestAnimationFrame for smoother visual
    const leftSpool = document.querySelector('.spool-left');
    const rightSpool = document.querySelector('.spool-right');
    const tapeMove = document.createElement('div');
    tapeMove.className = 'tape-move';
    const tapeWindow = document.querySelector('.tape-window');
    if (tapeWindow) tapeWindow.appendChild(tapeMove);

    let lastTime = 0;
    let tapeOffset = 0;

    function animate(now){
        if (!lastTime) lastTime = now;
        const dt = now - lastTime;
        lastTime = now;
        // increase offset proportionally to playbackRate and time delta
        const rate = isPlaying ? (audioEl.playbackRate || 1) : 0;
        tapeOffset += dt * 0.02 * rate; // tuned constant for visual speed
        tapeMove.style.backgroundPosition = `${Math.floor(tapeOffset)%100}px 0`;

        // spin spools CSS transform slightly based on currentTime
        if (isPlaying){
            leftSpool.style.transform = `rotate(${(audioEl.currentTime*360)%360}deg)`;
            rightSpool.style.transform = `rotate(${(audioEl.currentTime* -360)%360}deg)`;
        }

        rafId = requestAnimationFrame(animate);
    }

    function startSpoolAnimation(){
        if (!rafId) rafId = requestAnimationFrame(animate);
        leftSpool.classList.add('rotate');
        rightSpool.classList.add('rotate');
    }

    function stopSpoolAnimation(){
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null; lastTime = 0;
        leftSpool.classList.remove('rotate');
        rightSpool.classList.remove('rotate');
    }
});