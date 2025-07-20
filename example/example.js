/* 대충 src/index.js 에 있는 함수들... */

let url = "https://ccentury.dothome.co.kr/Ccentury/DTD/rank/Playlog.php";
getHtml(url, function(error, html) {
    if (error) {
        console.error(error.message);
        return;
    }
    console.log(htmlToMarkdown(html));
});
