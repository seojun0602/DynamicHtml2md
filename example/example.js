let {dh2md} = require("DynamicHtml2md");

let url = "https://ccentury.dothome.co.kr/Ccentury/DTD/rank/Playlog.php";
dh2md(url, function(error, html) {
    if (error) {
        console.error(error.message);
        return;
    }
    console.log(html);
});
