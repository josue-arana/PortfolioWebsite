(function () {
    'use strict';

    function initializeAnimation(root) {
        var animationContainer = root.querySelector('[data-logo-animation-canvas]');
        var fallback = root.querySelector('.artwork-identity-fallback');
        var loader = root.querySelector('[data-logo-animation-loader]');
        var animationSection = root.closest ? root.closest('[data-logo-animation-section]') : root.parentElement;
        var toggle = animationSection && animationSection.querySelector('[data-logo-animation-toggle]');
        var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        var animationPath = root.getAttribute('data-animation-path') || '/logo_animation.json';
        var animation = null;
        var scriptLoading = false;
        var animationReady = false;
        var sectionNearViewport = false;
        var userPaused = false;
        var readyTimeout = null;

        if (!animationContainer || !fallback || !loader || !toggle) {
            return;
        }

        function canAnimate() {
            return !motionQuery.matches;
        }

        function updatePlayback() {
            if (!animation || !animationReady) {
                return;
            }

            toggle.hidden = false;
            toggle.disabled = false;
            toggle.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
            toggle.textContent = userPaused ? 'Play animation' : 'Pause animation';

            if (canAnimate() && sectionNearViewport && document.visibilityState === 'visible' && !userPaused) {
                animation.play();
            } else {
                animation.pause();
            }
        }

        function showFallback(label) {
            if (readyTimeout !== null) {
                window.clearTimeout(readyTimeout);
                readyTimeout = null;
            }
            animationReady = false;
            fallback.hidden = false;
            loader.hidden = true;
            toggle.hidden = true;
            toggle.disabled = true;
            toggle.setAttribute('aria-pressed', 'false');
            toggle.textContent = label || 'Animation unavailable';
            animationContainer.replaceChildren();
        }

        function destroyAnimation() {
            if (readyTimeout !== null) {
                window.clearTimeout(readyTimeout);
                readyTimeout = null;
            }
            if (animation) {
                animation.destroy();
                animation = null;
            }
            animationReady = false;
            animationContainer.replaceChildren();
        }

        function handleAnimationFailure() {
            destroyAnimation();
            showFallback('Animation unavailable');
        }

        function createAnimation() {
            if (!canAnimate() || !window.bodymovin || animation) {
                loader.hidden = true;
                return;
            }

            try {
                animation = window.bodymovin.loadAnimation({
                    container: animationContainer,
                    renderer: 'svg',
                    loop: true,
                    autoplay: false,
                    path: animationPath
                });
                animation.addEventListener('DOMLoaded', function () {
                    if (readyTimeout !== null) {
                        window.clearTimeout(readyTimeout);
                        readyTimeout = null;
                    }
                    animationReady = true;
                    fallback.hidden = true;
                    loader.hidden = true;
                    updatePlayback();
                });
                animation.addEventListener('data_failed', handleAnimationFailure);
                readyTimeout = window.setTimeout(function () {
                    if (!animationReady) {
                        handleAnimationFailure();
                    }
                }, 15000);
            } catch (_error) {
                handleAnimationFailure();
            }
        }

        function loadAnimation() {
            if (!canAnimate() || animation || scriptLoading) {
                return;
            }

            loader.hidden = false;
            toggle.disabled = true;
            toggle.textContent = 'Loading animation…';

            if (window.bodymovin) {
                createAnimation();
                return;
            }

            scriptLoading = true;
            var script = document.createElement('script');
            script.src = '/lottie.js';
            script.async = true;
            script.onload = function () {
                scriptLoading = false;
                createAnimation();
            };
            script.onerror = function () {
                scriptLoading = false;
                handleAnimationFailure();
            };
            document.head.appendChild(script);
        }

        function handleMotionPreferenceChange() {
            if (!canAnimate()) {
                destroyAnimation();
                showFallback('Animation paused for reduced motion');
                return;
            }

            if (sectionNearViewport) {
                loadAnimation();
            }
            updatePlayback();
        }

        toggle.addEventListener('click', function () {
            if (!animationReady) {
                return;
            }
            userPaused = !userPaused;
            updatePlayback();
        });

        document.addEventListener('visibilitychange', updatePlayback);
        if (motionQuery.addEventListener) {
            motionQuery.addEventListener('change', handleMotionPreferenceChange);
        } else if (motionQuery.addListener) {
            motionQuery.addListener(handleMotionPreferenceChange);
        }

        showFallback(canAnimate() ? 'Loading animation…' : 'Animation paused for reduced motion');

        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                sectionNearViewport = entries[0].isIntersecting;
                if (sectionNearViewport) {
                    loadAnimation();
                }
                updatePlayback();
            }, { rootMargin: '200px 0px', threshold: 0.01 });
            observer.observe(root);
        } else {
            sectionNearViewport = true;
            loadAnimation();
        }
    }

    document.querySelectorAll('[data-logo-animation]').forEach(initializeAnimation);
}());
