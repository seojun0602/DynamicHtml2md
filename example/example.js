let {dh2md, getHtml} = require("DynamicHtml2md");

let url = "https://www.kobis.or.kr/kobis/business/main/main.do";

let options = {
    maxwt: 10000,
    timeout: 30000
};

dh2md(url, function(error, html) {
    if (error) {
        console.error(error.message);
        return;
    }
    console.log(html);
}, options);

/* Or you can use getHtml to get html.

getHtml(url, function(error, html) {
    if (error) {
        console.error(error.message);
        return;
    }
    console.log(html);
}, options);

// and you can parse to use Jsoup.parse

getHtml(url, function(error, html) {
    if (error) {
        console.error(error.message);
        return;
    }
    console.log(org.jsoup.Jsoup.parse(html)).text())
}, options);


*/