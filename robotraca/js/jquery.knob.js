/*!
 * jQuery Knob
 */
(function($) {
    'use strict';

    var Knob = function(elem) {
        this.$ = $(elem);
        this.value = this.$.val();
        this.max = this.$.attr('data-max') || 100;
        this.min = this.$.attr('data-min') || 0;
        
        var self = this;
        this.$.hide();
        
        this.canvas = $('<canvas></canvas>').insertAfter(this.$);
        this.ctx = this.canvas[0].getContext('2d');
        
        this.width = this.$.data('width') || 60;
        this.height = this.$.data('height') || 60;
        this.canvas.attr('width', this.width);
        this.canvas.attr('height', this.height);
        
        this.draw();
        
        var mousedown = false;
        this.canvas.on('mousedown touchstart', function(e) {
            mousedown = true;
            self.change(e);
        });
        
        $(document).on('mousemove touchmove', function(e) {
            if (mousedown) {
                self.change(e);
            }
        }).on('mouseup touchend', function() {
            mousedown = false;
        });
    };

    Knob.prototype.draw = function() {
        var ctx = this.ctx;
        var w = this.width;
        var h = this.height;
        var value = this.value;
        var max = this.max;
        var min = this.min;
        
        ctx.clearRect(0, 0, w, h);
        
        // Background circle
        ctx.beginPath();
        ctx.arc(w/2, h/2, w/2 - 5, 0, Math.PI * 2);
        ctx.fillStyle = '#2a2a2a';
        ctx.fill();
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Value arc
        var angle = (value - min) / (max - min) * Math.PI * 1.5 - Math.PI * 0.75;
        ctx.beginPath();
        ctx.arc(w/2, h/2, w/2 - 8, -Math.PI * 0.75, angle);
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // Center dot
        ctx.beginPath();
        ctx.arc(w/2, h/2, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ccc';
        ctx.fill();
    };

    Knob.prototype.change = function(e) {
        var offset = this.canvas.offset();
        var x = (e.pageX || e.originalEvent.touches[0].pageX) - offset.left;
        var y = (e.pageY || e.originalEvent.touches[0].pageY) - offset.top;
        
        var cx = this.width / 2;
        var cy = this.height / 2;
        
        var angle = Math.atan2(y - cy, x - cx);
        angle = angle + Math.PI * 0.75;
        if (angle < 0) angle += Math.PI * 2;
        
        var value = this.min + (angle / (Math.PI * 1.5)) * (this.max - this.min);
        value = Math.max(this.min, Math.min(this.max, value));
        
        this.value = Math.round(value);
        this.$.val(this.value).trigger('change');
        this.draw();
    };

    $.fn.knob = function() {
        return this.each(function() {
            new Knob(this);
        });
    };

})(jQuery);
