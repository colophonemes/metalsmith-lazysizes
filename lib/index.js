// var Imagemin = require('imagemin');
var rename = require('gulp-rename');
var fs = require('fs');
var path = require('path');
var minimatch = require('minimatch');
var cheerio = require('cheerio');

module.exports = function plugin(options) {

	options = options || {};
	var filename = false;
	var parent = options.parent || 'body';
	var ignore = options.ignore || false;
	var ignoreSelectors = options.ignoreSelectors || false;
	var defaultWidth  = options.defaultWidth || 100;
	var widths    = options.widths    || [100,480,768,992,1200];
	var qualities = options.qualities || [ 20, 40, 70, 70,  70];
	var includeImages = options.includeImages || true;
	var backgrounds = options.backgrounds || false;
	var queryString = options.querystring || false;
	var queryStrings = getQuerystrings();
	

	// main function
	return function (files, metalsmith, done){
		Object.keys(files)
		.filter(minimatch.filter('**/*.@(htm|html)'))
		.forEach(function(file){
			var $ = cheerio.load(files[file].contents);
			addMarkup($,backgrounds);
			files[file].contents = $.html();
		})
		done();
	}

	function addMarkup ($,backgrounds){

		selectors = backgrounds || [];
		if(includeImages) selectors = ['img'].concat(selectors)
		selectors = typeof selectors === 'string' ? [selectors] : selectors;
		// background = background || false;
		selectors.forEach(function(selector){
			
			$(parent).find(selector).each(function(){
				var isImage = selector === 'img' ? true : false;
				var isBackground = !isImage

				var el = $(this);
				var src = isImage ? el.attr('src') : el.css('background-image')
				if(src){
					if(ignore && minimatch(src,ignore)) return;
					if(ignoreSelectors && el.parents(ignoreSelectors).length > 0){
						return;
					}
					if(isBackground) src = src.match(/(?:^url\(["|']?)([^'"]*)(?:["|']?\))$/)[1]
					if(queryStrings)var urls = getURLsFromQuerystring(src);
					el.attr('data-sizes','auto');
					el.addClass('lazyload');
					if(isImage){
						el.attr('src',urls.widths[defaultWidth]);
						el.attr('data-srcset',urls.srcset.join(', '));
					} else {
						el.css({'background-image':'url('+urls.widths[defaultWidth]+')'});
						el.attr('data-bgset',urls.srcset.join(', '));
					}
				}
			})
		});
		return $;
	}
	function getSizePattern(src){
		// todo
	}
	function getQuerystrings(){
		if(!queryString) return false;
		var queryStrings = [];
		widths.forEach(function(width,index){
			var query = {};
			Object.keys(queryString).forEach(function(key){
				var val = queryString[key];
				if(val === '%%width%%') val = width;
				if(val === '%%quality%%') val = qualities[index];
				query[key] = val;
			})
			queryStrings.push(query)
		})
		return queryStrings;
	}

	function getURLsFromQuerystring(src){
		if(!queryStrings) return false;
		var src = src.split('?');
		var srcBase = src[0];

		var existingQueries = src[1];
		var existingQuerystring = {}

		var widthKey = getWidthKey();
		
		var srcset = [];
		var widths = {};
		if(existingQueries){
			existingQueries = existingQueries.split('&')
			existingQueries.forEach(function(query){
				query = query.split('=');
				existingQuerystring[query[0]] = query[1];
			})
		}

		// get rid of keys we don't want to add back to the query string
		var existingKeys = Object.keys(existingQuerystring)
		for(key in queryStrings[0]){
			var i = existingKeys.indexOf(key);
			if(i>-1){
				existingKeys.splice(i,1)
			}
		}


		for (var i = 0, l=queryStrings.length; i < l; i++) {
			var queryString = queryStrings[i];
			// see if the width at the breakpoint we're looking for is larger than the existing width
			if(existingQuerystring && existingQuerystring[widthKey] && existingQuerystring[widthKey] < queryString[widthKey]){
				break;
			}
			var newQueryString = [];
			Object.keys(queryString).forEach(function(key){
				newQueryString.push(key + '=' + queryString[key])
			})
			existingKeys.forEach(function(key){
				newQueryString.push(key + '=' + existingQuerystring[key])
			})
			var url = srcBase + '?' + newQueryString.join('&')
			widths[queryString[widthKey]] = url;
			srcset.push(url + ' ' + queryString[widthKey] + 'w');
		}
		return {srcset:srcset,widths:widths};
	}

	function getWidthKey(){
		if(!queryString) return false;
		var widthKey = false;
		for (key in queryString) {
			if(queryString[key] === '%%width%%') {
				widthKey = key;
				break;
			}
		}
		return widthKey;
	}
}