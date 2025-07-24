let {dh2md, getHtml, Cookie} = require("DynamicHtml2md");

let url = "https://www.kobis.or.kr/kobis/business/main/main.do";

// cookies 예시.
let cookies = [
    new Cookie("a", "1").setPath("/"),
    new Cookie("b", "2").setDomain("example.com"),
];

let options = {
    maxwt: 10000,
    timeout: 30000,
    userAgent: "KT/25.6.5",
    cookies: cookies
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

// and you can use Jsoup.parse to parse

getHtml(url, function(error, html) {
    if (error) {
        console.error(error.message);
        return;
    }
    console.log(org.jsoup.Jsoup.parse(html)).text())
}, options);


*/