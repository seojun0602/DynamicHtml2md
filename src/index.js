/*
   DynamicHtml2md. 2025.07.20
   Version: v1.0.3
   Author: seojun0602
   functions: getHtml, html2md, dh2md
*/

/**
 * getHtml. 웹뷰 기반으로 동적 웹페이지의 HTML을 가져오는 함수.
 * @param {string} url
 * @param {function(error, html)} callback
*/

/* 표준 및 레거시 API를 모두 지원하기 위해 App으로 통합.
   - 표준: App이 존재하면 그대로 사용
   - 레거시: Api를 참조하지만 원본은 수정하지 않음
   -> 양쪽 다 오염되지 않음.
*/

if (typeof App == 'undefined' && typeof Api != 'undefined') {
    App = Api;
    if (typeof App.runOnUiThread == 'undefined' && typeof App.UIThread == 'function') {
        App.runOnUiThread = App.UIThread;
    }
}

function getHtml(url, callback, options = {}) {
    let state = {
        html: null,
        error: null,
        isDone: false
    };
    
    let m = (options.maxwt ? options.maxwt : 10000);
    const o = `
(function() {
    window.signalScrapingComplete = function() {
        document.body.setAttribute('scraping-complete', 'true');
    };

    let debounceTimer;
    let lastMutationTime = Date.now();

    const observer = new MutationObserver(function(mutationsList) {
        lastMutationTime = Date.now();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (Date.now() - lastMutationTime >= 1500) {
                window.signalScrapingComplete();
                observer.disconnect();
            }
        }, 1000);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
    });

    setTimeout(() => {
        window.signalScrapingComplete();
        observer.disconnect();
    }, ${m});
})();`, f = `
(function() {
    const clonedBody = document.documentElement.cloneNode(true);
    const allElements = clonedBody.querySelectorAll('*');
    allElements.forEach(function(el) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || el.hidden === true) {
            el.remove();
        }
    });
    return clonedBody.outerHTML;
})();
`;

    let uiTask = function() {
        try {
            // getContext must be implemented on java
            let context = App.getContext();
            let webView = new android.webkit.WebView(context);
            let cookieManager = android.webkit.CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(webView, true);
            (options.cookies ? options.cookies : []).forEach(function(c) {
                cookieManager.setCookie(url, c.toString());
            });
            
            webView.getSettings().setUserAgentString(options.userAgent ? options.userAgent : "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36");
            webView.getSettings().setJavaScriptEnabled(true);
            webView.getSettings().setDomStorageEnabled(true);

            webView.setWebViewClient(new JavaAdapter(android.webkit.WebViewClient, {
                onPageFinished: function(view, finishedUrl) {
                    let pollForCompletion = function() {
                        if (state.isDone) return;

                        view.evaluateJavascript(`(function(){ return document.body.getAttribute('scraping-complete'); })();`, 
                            new JavaAdapter(android.webkit.ValueCallback, {
                                onReceiveValue: function(value) {
                                    if (state.isDone) return;

                                    if (value === '"true"') {
                                        view.evaluateJavascript(f, new JavaAdapter(android.webkit.ValueCallback, {
                                            onReceiveValue: function(finalHtml) {
                                                state.html = finalHtml;
                                                state.isDone = true;
                                                view.destroy();
                                            }
                                        }));
                                    } else {
                                        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(
                                            new java.lang.Runnable({ run: pollForCompletion }), 300
                                        );
                                    }
                                }
                            })
                        );
                    };

                    view.evaluateJavascript(o, null);
                    pollForCompletion();
                },

                onReceivedError: function(view, request, error) {
                    state.error = error.getDescription();
                    state.isDone = true;
                    view.destroy();
                }
            }));

            webView.loadUrl(url);

        } catch (e) {
            state.error = e.toString();
            state.isDone = true;
        }
    };
    
    // runOnUiThread must be implemented on java
    App.runOnUiThread(uiTask, function(error, result) {
        if (error) {
            state.error = error.toString();
            state.isDone = true;
        }
    });

    const timeout = (options.timeout ? options.timeout : 30000);
    let waited = 0;
    const interval = 100;

    function checkDone() {
        if (state.isDone) {
            if (state.error) {
                callback(new Error(state.error), null);
            } else {
                var finalHtml = state.html;
                if (finalHtml && finalHtml.startsWith('"') && finalHtml.endsWith('"')) {
                    finalHtml = finalHtml.substring(1, finalHtml.length - 1)
                                        .replace(/\\u([\dA-F]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
                                          .replace(/\\"/g, '"')
                                          .replace(/\\n/g, '\n')
                                          .replace(/\\r/g, '\r')
                                          .replace(/\\t/g, '\t')
                }
                callback(null, finalHtml);
            }
        } else if (waited >= timeout) {
            callback(new Error("Timeout: Failed to get HTML within " + (timeout / 1000) + " seconds."), null);
        } else {
            java.lang.Thread.sleep(interval);
            waited += interval;
            checkDone();
        }
    }

    checkDone();
}

/** html2md. html을 마크다운으로 변환하는 함수.
  * @param {string} html
*/
function html2md(html) {

    let extractedJsonData = [];
    
    html = html.replace(/(<tbody[\s\S]*?<\/tbody>)/gi, '<table>$1</table>');
    html = html.replace(/<ruby[\s\S]*?<\/ruby>/gi, function(ruby){ return ruby.replace(/<rp>[\s\S]*?<\/rp>/gi, '').replace(/<rt>([\s\S]*?)<\/rt>/gi, '($1)').replace(/<[^>]+>/g, '');});

    let processedHtml = html.replace(/<br[^>]*>/gi, '\n');
    processedHtml = processedHtml.replace(/<\/p>/gi, '</p>\n');
    processedHtml = processedHtml.replace(/<\/div>/gi, '</div>\n');
    processedHtml = processedHtml.replace(/<!--[\s\S]*?-->/g, '');
    processedHtml = processedHtml.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
    processedHtml = processedHtml.replace(/<aside[\s\S]*?<\/aside>/gi, '');
    processedHtml = processedHtml.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    processedHtml = processedHtml.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    processedHtml = processedHtml.replace(/<style[\s\S]*?<\/style>/gi, '');
    processedHtml = processedHtml.replace(/<svg[\s\S]*?<\/svg>/gi, '');

    processedHtml = processedHtml.replace(/<script([\s\S]*?)>([\s\S]*?)<\/script>/gi, function(match, attrs, scriptContent) {
        let typeAttr = attrs.match(/type="([^"]*)"/);
        if (typeAttr && (typeAttr[1] === 'application/json' || typeAttr[1] === 'application/ld+json')) {
            try {
                jsonObj = JSON.parse(scriptContent);
                extractedJsonData.push(JSON.stringify(jsonObj, null, 2));
            } catch (e) {}
        } else {
            let jsonMatches = scriptContent.match(/=\s*(\{[\s\S]*\}|\[[\s\S]*\]);?/);
            if (jsonMatches && jsonMatches[1]) {
                 try {
                    jsonObj = JSON.parse(jsonMatches[1]);
                    extractedJsonData.push(JSON.stringify(jsonObj, null, 2));
                } catch (e) {}
            }
        }
        return '';
    });

    let markdown = processedHtml;

    markdown = markdown.replace(/<table[\s\S]*?<\/table>/gi, function(tableHtml) {
        let tableMarkdown = '';
        let headerProcessed = false;
        const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
        rows.forEach(rowHtml => {
            const cells = [];
            const thCells = rowHtml.match(/<th[\s\S]*?<\/th>/gi) || [];
            const tdCells = rowHtml.match(/<td[\s\S]*?<\/td>/gi) || [];
            const allCells = thCells.concat(tdCells);
            allCells.forEach(cellHtml => {
                cells.push(cellHtml.replace(/<[^>]+>/g, '').trim());
            });
            if (cells.length > 0) {
                 tableMarkdown += '| ' + cells.join(' | ') + ' |\n';
            }
            if (!headerProcessed && thCells.length > 0) {
                tableMarkdown += '|' + '---|'.repeat(thCells.length) + '\n';
                headerProcessed = true;
            }
        });
        return '\n' + tableMarkdown + '\n';
    });

    markdown = markdown.replace(/<img[^>]*>/gi, function(imgTag) {
        const srcMatch = imgTag.match(/src="([^"]*)"/);
        const altMatch = imgTag.match(/alt="([^"]*)"/);

        const src = srcMatch ? srcMatch[1] : '';
        const alt = altMatch ? altMatch[1] : '';

        if (!src || src.startsWith('data:image')) {
            return '';
        }

        return `![${alt}](${src})\n`;
    });

    markdown = markdown.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, function(match, level, content) {
        return '\n' + '#'.repeat(parseInt(level)) + ' ' + content.trim() + '\n';
    });

    markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, function(listContent) {
        return listContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, function(_, liContent) {
            return '* ' + liContent.trim() + '\n';
        });
    });

    markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, function(listContent) {
        let count = 1;
        return listContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, function(_, liContent) {
            return `${count++}. ${liContent.trim()}\n`;
        });
    });

    markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

    markdown = markdown.replace(/<(strong|b)>(.*?)<\/\1>/gi, '**$2**');
    markdown = markdown.replace(/<(em|i)>(.*?)<\/\1>/gi, '*$2*');

    markdown = markdown.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
    markdown = markdown.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');

    markdown = markdown.replace(/<hr[^>]*>/gi, '\n---\n');

    markdown = markdown.replace(/<[^>]+>/g, '');
    markdown = markdown.replace(/(\s*\n){3,}/g, '\n\n');
    markdown = markdown.replace(/>/g, '>').replace(/</g, '<').replace(/&/g, '&');

    if (extractedJsonData.length > 0) {
        markdown += '\n---\n\n## json data\n\n';
        extractedJsonData.forEach(function(jsonString) {
            markdown += '```json\n' + (jsonString ? jsonString : "") + '\n```\n\n';
        });
    }
    
    markdown = markdown.replace(/^[ \t]+/gm, '');
    markdown = markdown.replace(/(\s*\n){3,}/g, '\n\n'); 
    
    return markdown.trim();
}

/**
 * dh2md. url을 html을 마크다운로 변환하는 함수.
 * @param {string} url
 * @param {function(error, markdown)} callback
 * @param {Object} options(maxwt(ms), timeout(ms))
*/
function dh2md(url, callback, options = {}) {
    getHtml(url, (err, html) => {
        if (err) return callback(err, null);
        let markdown = html2md(html);
        callback(null, markdown);
    }, options);
}

function Cookie(name, value) {
    this.name = name;
    this.value = value;
    this.path = "/";
    this.domain = null;
    this.expires = null;
    this.secure = false;
    this.sameSite = null;
}

Cookie.prototype.setPath = function(path) {
    this.path = path;
    return this;
};

Cookie.prototype.setDomain = function(domain) {
    this.domain = domain;
    return this;
};

Cookie.prototype.setExpires = function(expires) {
    if (expires instanceof Date) {
        this.expires = expires.toUTCString();
    } else {
        this.expires = expires;
    }
    return this;
};

Cookie.prototype.setSecure = function(secure) {
    this.secure = (secure !== false);
    return this;
};

Cookie.prototype.setSameSite = function(sameSite) {
    this.sameSite = sameSite;
    return this;
};

Cookie.prototype.toString = function() {
    var parts = [this.name + "=" + this.value];
    if (this.path) parts.push("path=" + this.path);
    if (this.domain) parts.push("domain=" + this.domain);
    if (this.expires) parts.push("expires=" + this.expires);
    if (this.secure) parts.push("secure");
    if (this.sameSite) parts.push("SameSite=" + this.sameSite);
    return parts.join("; ");
};

module.exports = {
    getHtml,
    html2md,
    dh2md,
    Cookie
};