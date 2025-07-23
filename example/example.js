let {dh2md, getHtml} = require("DynamicHtml2md");

let url = "https://ccentury.dothome.co.kr/Ccentury/DTD/rank/Playlog.php";

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

*/