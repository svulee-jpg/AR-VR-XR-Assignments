/*
 * voice.js
 * AI-driven feature: speech recognition with the browser's Web Speech API
 * (SpeechRecognition, English, en-US). In Chrome the audio is sent to Google's
 * speech service while recognition is on; the app itself stores no audio.
 *
 * The module never throws: every failure becomes a status that the app shows as
 * a message, and the colour buttons keep working (this is the fallback).
 *
 * Statuses passed to onStatus(status, detail):
 *   'unsupported' - the browser has no SpeechRecognition
 *   'listening'   - the microphone is on
 *   'stopped'     - turned off by the user
 *   'denied'      - the user (or browser policy) blocked the microphone
 *   'no-mic'      - no microphone found
 *   'network'     - the speech service could not be reached
 *   'error'       - any other error (detail has the code)
 */
(function (root) {
  'use strict';

  var SpeechRecognition = root.SpeechRecognition || root.webkitSpeechRecognition;

  var rec = null;
  var wanted = false; // the user wants the microphone on
  var fatal = false; // an error that makes restarting pointless
  var handlers = { status: function () {}, interim: function () {}, final: function () {} };

  function supported() {
    return !!SpeechRecognition;
  }

  function create() {
    var r = new SpeechRecognition();
    r.lang = 'en-US';
    r.continuous = true; // keep listening for several commands
    r.interimResults = true; // show what is being heard while the user speaks
    r.maxAlternatives = 1;

    r.onstart = function () {
      handlers.status('listening');
    };

    r.onresult = function (event) {
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var result = event.results[i];
        var text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) handlers.final(text, result[0].confidence);
        else handlers.interim(text);
      }
    };

    r.onerror = function (event) {
      var code = event.error;
      if (code === 'no-speech' || code === 'aborted') return; // normal, restart in onend
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        fatal = true;
        handlers.status('denied', code);
      } else if (code === 'audio-capture') {
        fatal = true;
        handlers.status('no-mic', code);
      } else if (code === 'network') {
        fatal = true;
        handlers.status('network', code);
      } else {
        handlers.status('error', code);
      }
    };

    // Chrome ends the session after a pause; restart it while the user wants voice.
    r.onend = function () {
      if (wanted && !fatal) {
        try {
          r.start();
        } catch (e) {
          /* already started */
        }
      } else if (!fatal) {
        handlers.status('stopped');
      }
    };
    return r;
  }

  /** Must be called from a user gesture (click): this is when the browser asks for permission. */
  function start() {
    if (!supported()) {
      handlers.status('unsupported');
      return false;
    }
    wanted = true;
    fatal = false;
    try {
      if (!rec) rec = create();
      rec.start();
    } catch (e) {
      // start() throws if already running: that is fine.
    }
    return true;
  }

  function stop() {
    wanted = false;
    if (rec) {
      try {
        rec.stop();
      } catch (e) {
        /* not running */
      }
    }
    if (!fatal) handlers.status('stopped');
  }

  root.VoiceModule = {
    supported: supported,
    start: start,
    stop: stop,
    isWanted: function () { return wanted && !fatal; },
    onStatus: function (fn) { handlers.status = fn; },
    onInterim: function (fn) { handlers.interim = fn; },
    onFinal: function (fn) { handlers.final = fn; }
  };
})(window);
