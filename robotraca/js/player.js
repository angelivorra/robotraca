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
        {src: 'audio/track1.mp3', title: 'Track 1'},
        {src: 'audio/track2.mp3', title: 'Track 2'}
    ];

    let current = 0;
    let isPlaying = false;

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
});