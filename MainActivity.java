package com.cdce.team;

import android.os.Bundle;
import android.webkit.ValueCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onResume() {
        super.onResume();
        // Tell the web page the native back button is wired (shown in settings)
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().evaluateJavascript("window.__cdceNative=true", null);
                    }
                }
            }, 2500);
        }
    }

    @Override
    public void onBackPressed() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            super.onBackPressed();
            return;
        }
        getBridge().getWebView().evaluateJavascript(
            "(function(){try{return (window.__cdceBackPress && window.__cdceBackPress()) ? 'yes' : 'no';}catch(e){return 'no';}})()",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String value) {
                    // value arrives JSON-encoded, e.g. "\"yes\""
                    if (value != null && (value.contains("yes"))) {
                        return; // page went one step back, stay in app
                    }
                    moveTaskToBack(true); // no step back left: send app to background
                }
            });
    }
}
