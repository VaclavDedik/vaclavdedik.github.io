function load_more(n) {
    var counter = 0;
    $(".blog-post").each(function(index, elem) {
        console.log(index);
        if (!$(elem).is(":visible")) {
            $(elem).show();
            counter++;
        }
        if ($(elem).is(":last-child")) {
            $(".pager-nav").hide();
        }
        if (counter >= n) {
            return false;
        }
    });
}