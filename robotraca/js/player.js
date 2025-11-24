$(document).ready(function() {
    'use strict';

    var audio = $('#audio_player')[0];
    var $reelLeft = $('#reel_left .reel');
    var $reelRight = $('#reel_right .reel');
    var currentSide = 'A';
    var isPlaying = false;

    var tracks = {
        A: 'audio/track1.mp3',
        B: 'audio/track2.mp3'
    };

    // Initialize volume control
    $('#volume_knob').knob();
    $('#volume_knob').val(50);
    audio.volume = 0.5;

    $('#volume_knob').on('change', function() {
        audio.volume = $(this).val() / 100;
    });

    // Show initial side
    $('.side_a').addClass('active');

    // Autoplay on page load (con manejo de políticas de autoplay)
    function tryAutoplay() {
        var playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(function() {
                // Autoplay funcionó
                isPlaying = true;
                $reelLeft.addClass('spinning');
                $reelRight.addClass('spinning');
                $('#play').css('border-color', '#667eea');
            }).catch(function(error) {
                // Autoplay bloqueado por el navegador
                console.log('Autoplay prevented by browser:', error);
                // El usuario tendrá que hacer click para reproducir
            });
        }
    }

    // Intentar autoplay después de un pequeño delay
    setTimeout(tryAutoplay, 100);

    // Format time
    function formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        var mins = Math.floor(seconds / 60);
        var secs = Math.floor(seconds % 60);
        return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    // Update time display
    audio.addEventListener('timeupdate', function() {
        $('#current_time').text(formatTime(audio.currentTime));
        $('#total_time').text(formatTime(audio.duration));
    });

    audio.addEventListener('loadedmetadata', function() {
        $('#total_time').text(formatTime(audio.duration));
    });

    // Play button
    $('#play').on('click', function() {
        if (audio.paused) {
            audio.play();
            isPlaying = true;
            $reelLeft.addClass('spinning');
            $reelRight.addClass('spinning');
            $(this).css('border-color', '#667eea');
        } else {
            audio.pause();
            isPlaying = false;
            $reelLeft.removeClass('spinning');
            $reelRight.removeClass('spinning');
            $(this).css('border-color', '#444');
        }
    });

    // Stop button
    $('#stop').on('click', function() {
        audio.pause();
        audio.currentTime = 0;
        isPlaying = false;
        $reelLeft.removeClass('spinning');
        $reelRight.removeClass('spinning');
        $('#play').css('border-color', '#444');
    });

    // Rewind button
    $('#rew').on('click', function() {
        audio.currentTime = Math.max(0, audio.currentTime - 5);
    });

    // Fast forward button
    $('#ff').on('click', function() {
        audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    });

    // Switch side button
    $('#switch_side').on('click', function() {
        var wasPlaying = !audio.paused;
        audio.pause();
        
        if (currentSide === 'A') {
            currentSide = 'B';
            $('.side_a').removeClass('active');
            $('.side_b').addClass('active');
        } else {
            currentSide = 'A';
            $('.side_b').removeClass('active');
            $('.side_a').addClass('active');
        }
        
        audio.src = tracks[currentSide];
        audio.load();
        
        if (wasPlaying) {
            audio.play();
        } else {
            $reelLeft.removeClass('spinning');
            $reelRight.removeClass('spinning');
            $('#play').css('border-color', '#444');
        }
    });

    // Audio ended event
    audio.addEventListener('ended', function() {
        isPlaying = false;
        $reelLeft.removeClass('spinning');
        $reelRight.removeClass('spinning');
        $('#play').css('border-color', '#444');
        audio.currentTime = 0;
    });

    // Keyboard shortcuts
    $(document).on('keydown', function(e) {
        switch(e.keyCode) {
            case 32: // Space - Play/Pause
                e.preventDefault();
                $('#play').click();
                break;
            case 37: // Left arrow - Rewind
                $('#rew').click();
                break;
            case 39: // Right arrow - Fast forward
                $('#ff').click();
                break;
            case 83: // S - Stop
                $('#stop').click();
                break;
            case 88: // X - Switch
                $('#switch_side').click();
                break;
        }
    });
});
