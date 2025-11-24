/* Adapted CassettePlayer behavior (lightweight) */
document.addEventListener('DOMContentLoaded', function(){
    const audio = document.getElementById('audioElement');
    const playBtn = document.getElementById('cp-play');
    const stopBtn = document.getElementById('cp-stop');
    const ffBtn = document.getElementById('cp-ff');
    const rwBtn = document.getElementById('cp-rw');
    const switchBtn = document.getElementById('cp-switch');
    const volEl = document.getElementById('cp-volume');
    const tracks = [
        {src:'audio/track1.mp3', title: 'Track 1'},
        {src:'audio/track2.mp3', title: 'Track 2'}
    ];
    let current = 0; let playing=false;

    function load(i){
        current = i%tracks.length; audio.src = tracks[current].src; document.getElementById('cp-track-title').textContent = tracks[current].title;
    }
    function tryPlay(){
        audio.play().then(()=>{playing=true; playBtn.textContent='▮▮'; document.querySelectorAll('.spool').forEach(s=>s.classList.add('rotate'));}).catch(()=>{document.getElementById('overlayPlay').hidden=false});
    }
    function doPause(){audio.pause(); playing=false; playBtn.textContent='▶'; document.querySelectorAll('.spool').forEach(s=>s.classList.remove('rotate'));}

    playBtn.addEventListener('click', ()=>{ if(playing) doPause(); else tryPlay(); document.getElementById('overlayPlay').hidden=true; });
    stopBtn.addEventListener('click', ()=>{ audio.pause(); audio.currentTime=0; doPause(); });
    ffBtn.addEventListener('click', ()=>{ audio.currentTime = Math.min(audio.duration||0, audio.currentTime + 10); });
    rwBtn.addEventListener('click', ()=>{ audio.currentTime = Math.max(0, audio.currentTime - 10); });
    switchBtn.addEventListener('click', ()=>{ load((current+1)%tracks.length); tryPlay(); });
    volEl.addEventListener('input', ()=>{ audio.volume = Number(volEl.value); });

    document.getElementById('overlayPlay').addEventListener('click', ()=>{ tryPlay(); document.getElementById('overlayPlay').hidden=true });

    audio.addEventListener('ended', ()=>{ load((current+1)%tracks.length); tryPlay(); });

    // URL params
    const params = new URLSearchParams(location.search);
    const autoplay = params.get('autoplay')==='1' || params.get('autoplay')==='true';
    const trackParam = parseInt(params.get('track')) || 1;
    load(Math.max(0, trackParam-1));
    if(autoplay) tryPlay();
});
