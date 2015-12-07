function load_blog_posts(n, show_more) {
    show_more = typeof show_more !== 'undefined' ? show_more : false;

    var curr_tag = location.hash.replace("#", "");
    var tag_class = "tag-" + curr_tag;
    var counter = 0;
    var no_posts = true;

    // if no tag set and we don't want more posts, exit
    if (!curr_tag && !show_more) {
        return;
    }
    // Iterate over all blog posts and show only the relevent
    $(".blog-post").each(function(index, elem) {
        var valid_post = !curr_tag || $(elem).find("." + tag_class).hasClass(tag_class);
        var visible_post = $(elem).is(":visible");

        if (valid_post && !visible_post) {
            no_posts = false;
            $(elem).show();
            counter++;
        } else if (!valid_post && visible_post) {
            $(elem).hide();
            counter--;
        } else if (valid_post && visible_post) {
            no_posts = false;
        }
        if ($(elem).is(":last-child")) {
            $(".pager-nav").hide();
        }
        if (counter >= n) {
            return false;
        }
    });
    // If there are no posts, show message informing reader
    if (no_posts) {
        var message = "There are currently no blog posts.";
        if (curr_tag) {
            message = "There are currently no blog posts with tag <b>"
                    + curr_tag + "</b>.";
        }

        $("#no-blog-posts-message").parent().show();
        $("#no-blog-posts-message").html(message);
    }
}
