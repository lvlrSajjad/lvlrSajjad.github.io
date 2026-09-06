/*
Theme: IAMX by Trendy Theme (trendytheme.net)
Trimmed to the behaviour this page actually uses.

Removed: Shuffle portfolio grid, Magnific Popup, FitVids, the count-up
counters, the skill progress bars, the AJAX contact form and the Google Map.
None of their plugins are loaded any more, so each was throwing on load — and
because they all sat inside this one ready handler, the first throw (Shuffle)
aborted everything below it, including WOW and Stellar.
*/

jQuery(function ($) {

    'use strict';

    /* ---------------------------------------------- /*
     * Preloader
    /* ---------------------------------------------- */

    $(window).ready(function () {
        $('#pre-status').fadeOut();
        $('#tt-preloader').delay(350).fadeOut('slow');
    });


    // -------------------------------------------------------------
    // Animated scrolling / Scroll Up
    // -------------------------------------------------------------

    (function () {
        $('a[href^="#"]').on('click', function (e) {
            var href = $(this).attr('href');
            if (href === '#') {
                return;
            }
            var $target = $(href);
            if (!$target.length) {
                return;
            }
            e.preventDefault();
            $('html, body').stop().animate({
                scrollTop: $target.offset().top
            }, 700);
        });
    }());


    // -------------------------------------------------------------
    // Full Screen Slider
    // -------------------------------------------------------------

    (function () {
        $('.tt-fullHeight').height($(window).height());

        $(window).resize(function () {
            $('.tt-fullHeight').height($(window).height());
        });
    }());


    // -------------------------------------------------------------
    // Sticky Menu
    // -------------------------------------------------------------

    (function () {
        $('.header').sticky({
            topSpacing: 0
        });

        $('body').scrollspy({
            target: '.navbar-custom',
            offset: 70
        });
    }());


    // -------------------------------------------------------------
    // Back To Top
    // -------------------------------------------------------------

    (function () {
        $(window).scroll(function () {
            if ($(this).scrollTop() > 100) {
                $('.scroll-up').fadeIn();
            } else {
                $('.scroll-up').fadeOut();
            }
        });
    }());


    // -------------------------------------------------------------
    // Stellar, for background scrolling
    // -------------------------------------------------------------

    $(window).on('load', function () {
        var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
            .test(navigator.userAgent);
        var reduceMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!isMobile && !reduceMotion) {
            $.stellar({
                horizontalScrolling: false,
                responsive: true
            });
        }
    });


    // -------------------------------------------------------------
    // WOW JS
    // -------------------------------------------------------------

    (function () {
        // WOW hides .wow elements until they scroll into view. If the visitor
        // has asked for reduced motion, skip init entirely so nothing is
        // hidden waiting for an animation that will never play.
        var reduceMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!reduceMotion && typeof WOW === 'function') {
            new WOW({ mobile: false }).init();
        }
    }());

});
