var lwip = require('lwip');
// var Imagemin = require('imagemin');
var rename = require('gulp-rename');
var fs = require('fs');
var path = require('path');
var minimatch = require('minimatch');
var _ = require('lodash');
var cheerio = require('cheerio');

module.exports = function plugin(options) {

	options = options || {};
	var patterns = options.pattern || ['**/*.+(jpg|jpeg|png|gif)'];
	var widths = options.sizes || [100, 500, 1000];
	var backgrounds = options.backgrounds || false;

	// main function
	return function (files, metalsmith, done){

		var images = [];
		var imageSizes = {};

		var processImages = function(){
			// get a list of images
			patterns.forEach(function(pattern){
				images = images.concat( minimatch.match(Object.keys(files),pattern) );
			});
			// no point running through this if there are no images — just get out of here...
			if(images.length===0){
				done();
				return;
			}
			// process images
			var c=1;
			images.forEach(function(imgPath){

				imageSizes[imgPath] = {};

				widths.forEach(function(width){
					// open the image using lwip
					var format = path.extname(imgPath).replace('.','');
					lwip.open(files[imgPath].contents, format, function(err,image){
						// handle errors
						if(err) { console.error(err); return; }
						// set vars
						var aspectRatio = image.width() / image.height(),
							height = Math.round(width / aspectRatio),
							outFile = imgPath.replace(path.extname(imgPath),'.'+width+'x'+height+path.extname(imgPath))
							originalWidth = image.width(),
							options = {};
						if(format === 'jpg'){
							options.quality = 70;
						} else if (format === 'png') {
							compression: "high"
						}
						imageSizes[imgPath][originalWidth] = imgPath;
						// pass to a function to ensure variables use values, not references
						(function(width,height,outFile,originalWidth,options){
							// resize image down if it's larger than the target width
							if(width<originalWidth){
								image.batch()
								.resize(width,height)
								.toBuffer(format,options,function(err, buffer){
									if(err) { console.error(err); return; }
									// add the file back into the main Metalsmith array
									file = _.create(files[imgPath]);
									file.contents = buffer;
									files[outFile] = file;
									// log this file in our list of image sizes
									imageSizes[imgPath][width] = outFile;
									// start processing HTML files once we're done
									if(c===images.length * widths.length){
										processHTML();
									}
									c++;
								});
							// duplicate guard clause to trigger processing HTML if last iteration doesn't resize an image
							} else {
								if(c===images.length * widths.length){
									processHTML();
								}
								c++
							}
						}(width,height,outFile,originalWidth,options))
					});

				});
			});	
		}

		var processHTML = function(){
			var html = minimatch.match(Object.keys(files),'**/*.@(htm|html)');
			html.forEach(function(file){
				$ = cheerio.load(files[file].contents);
				addMarkup($,'img');

				// process background images
				if(backgrounds){
					backgrounds.forEach(function(selector){
						addMarkup($,selector,true);
					})
				}

				files[file].contents = $.html();
			})
			done();
		}



		
		var addMarkup = function($,selector,background){
			background = background || false;
			$(selector).each(function(){
				var img = $(this);
				var src = !background ? img.attr('src').replace('/','',1) : img.css('background-image').replace("url(/",'').replace(")","");
				var images = imageSizes[src];
				var srcset = [];
				if(images){
					// get a list of the available sizes
					var sizes = Object.keys(images);
					sizes.forEach(function(size,index){
						sizes[index] = parseInt(sizes[index]);
						srcset.push('/' + images[size] + ' ' + size + 'w');
					})
					sizes.sort(function(a,b){
						return a-b;
					});
					img.attr('data-sizes','auto');
					img.addClass('lazyload');
					if(!background){
						img.attr('src','/'+images[sizes[0]]);
						img.attr('data-srcset',srcset.join(', '));
					} else {
						img.css({'background-image':'url(/'+images[sizes[0]]}+')');
						img.attr('data-bgset',srcset.join(', '));
					}
				}
			});
		}

		processImages();
	}
}