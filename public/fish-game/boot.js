//在H5项目的index.htmlHEAD部分引入即可
//作用 1、防止index.html被缓存  2、去掉code和state字段
function urlParse() {
    var params = {};
    if (window.location == null) {
        return params;
    }
    var name, value;
    var str = window.location.href.split('#')[0];//取得整个地址栏
    var num = str.indexOf("?")
    str = str.substr(num + 1); //取得所有参数   stringvar.substr(start [, length ]

    var arr = str.split("&"); //各个参数放到数组里
    for (var i = 0; i < arr.length; i++) {
        num = arr[i].indexOf("=");
        if (num > 0) {
            name = arr[i].substring(0, num);
            value = arr[i].substr(num + 1);
            params[name] = value;
        }
    }
    return params;
}

var KEY_OF_PARAMS = '__qlz_cocos_creator_tips__';
var args = urlParse();

function foo() {
    //如果已经有CODE了，则将CODE存到本地，并去掉code参数。再刷新本页。
    if(args['code']){
        window.localStorage.setItem('code',args['code']);
        delete args['code'];
        delete args['state'];
    }
	else{
		var rnd = args['__rnd__'];
		var oldParams = window.localStorage.getItem(KEY_OF_PARAMS);
		if(rnd != null && oldParams != rnd){
			//如果参数不同，肯定是获取到了最新的网页了。
			window.localStorage.setItem(KEY_OF_PARAMS, rnd);
			return;
		}
	}

    //如果参数未变，则需要通过添加随机参数的方式进行页面刷新。
    var arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'A', 'b', 'B', 'c', 'C', 'd', 'D', 'e', 'E', 'f', 'F', 'g', 'G', 'h', 'H', 'i', 'I'
        , 'j', 'J', 'k', 'K', 'l', 'L', 'm', 'M', 'n', 'N', 'o', 'O', 'p', 'P', 'q', 'Q', 'r', 'R', 's', 'S', 't', 'T', 'u', 'U', 'v', 'V', 'w', 'W', 'x', 'X'
        , 'y', 'Y', 'z', 'Z'];
    var rnd = '';
    for (var i = 0; i < 4; ++i) {
        var idx = Math.floor(Math.random() * arr.length);
        rnd += arr[idx];
    }

    args['__rnd__'] = rnd;
    var url = window.location.href.split('?')[0];
    var sep = '?';
    for(var k in args){
        url += sep + k + '=' + args[k];
        sep = '&';
    }
    var arr2 = window.location.href.split('#');
    if (arr2.length > 1) {
        url += '#' + arr2[1];
    }
    window.location.replace(url);
}
foo();