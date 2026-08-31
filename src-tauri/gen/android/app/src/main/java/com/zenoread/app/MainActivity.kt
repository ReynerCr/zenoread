package com.zenoread.app

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsCompat.Type

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  // The WebView reports safe-area insets as 0 (Chromium bug 441253216), so the
  // system bars are read natively and injected as CSS variables for padding.
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    val root = window.decorView
    ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
      injectInsets(webView, insets)
      insets
    }
    // First inset dispatch can happen before the page is ready; re-inject a
    // few times after load so the variables are set when the page renders.
    for (delay in longArrayOf(300, 800, 2000, 5000)) {
      root.postDelayed({ injectInsets(webView, ViewCompat.getRootWindowInsets(root)) }, delay)
    }
  }

  private fun injectInsets(webView: WebView, insets: WindowInsetsCompat?) {
    if (insets == null) return
    val density = resources.displayMetrics.density
    val bars = insets.getInsets(Type.systemBars() or Type.displayCutout())
    val js = buildString {
      append("document.documentElement.style.setProperty('--safe-top','")
      append(bars.top / density)
      append("px');")
      append("document.documentElement.style.setProperty('--safe-bottom','")
      append(bars.bottom / density)
      append("px');")
      append("document.documentElement.style.setProperty('--safe-left','")
      append(bars.left / density)
      append("px');")
      append("document.documentElement.style.setProperty('--safe-right','")
      append(bars.right / density)
      append("px');")
    }
    webView.evaluateJavascript(js, null)
  }
}
