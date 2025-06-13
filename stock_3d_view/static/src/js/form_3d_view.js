odoo.define('stock_3d_view.action_open_form_3d_view', function(require) {
	'use strict';
	var AbstractAction = require('web.AbstractAction');
	var core = require('web.core');
	var rpc = require('web.rpc');
	var QWeb = core.qweb;
	var Dialog = require('web.Dialog');
	var ajax = require('web.ajax');
	var PositionDialog = Dialog.extend({
		/**
		 * Initializes the PositionDialog instance.
		 *
		 * @constructor
		 * @param {Object} parent - The parent object.
		 * @param {Object} options - Configuration options.
		 * @param {Object} options.pointer - The pointer object.
		 * @param {Function} options.close - Callback function for closing the dialog.
		 */
		init: function(parent, options) {
			var opt = options;
			this._super(...arguments)
			this.pointer = opt.pointer
			this.onClickClose = opt.close
		},
		/**
		 * Renders the element and sets its position.
		 *
		 */
		renderElement: function() {
			this._super()
			this.$modal.find('.modal-dialog').css({
				position: 'absolute',
				left: this.pointer.x,
				top: this.pointer.y,
			})
		}
	})
	//Extends abstract action class to add event listener for 3D button.
	var open_form_3d_view = AbstractAction.extend({
		template: 'Location3DFormView',
		events: _.extend({}, AbstractAction.prototype.events, {
			'click .breadcrumb-item a': 'onBreadcrumbClick'
		}),
		/**
		 * Handles the click event on breadcrumbs.
		 *
		 * @param {Event} ev - The click event object.
		 */
		onBreadcrumbClick: function(ev) {
			let jsId = this.$(ev.target).attr('jsId');
			this.actionService.restore(jsId);
		},
		/**
		 * Initializes the open_form_3d_view instance.
		 *
		 * @constructor
		 * @param {Object} parent - The parent object.
		 * @param {Object} action - The action configuration.
		 */
		init: function(parent, action) {
			this._super(...arguments)
			this.breadcrumbs = parent.wowlEnv.config.breadcrumbs
			this.actionService = parent.actionService;
		},
		/**
		 * Starts the open_form_3d_view action.
		 */
		start: function() {
			this.Open3DView();
		},
		/**
		 * Starts the process of displaying rendered 3D object of stock.location or product.template.
		 */
		Open3DView: function() {
			var self = this;
			var wh_data;
			var data;
			var loc_quant;
			var product_data;
			let controls, renderer, clock, scene, camera, pointer, raycaster;
			var mesh, group;
			var material;
			var loc_color;
			var loc_opacity = 0.5;
			var textSize;
			let selectedObject = null;
			var dialogs = null;
			var wh_id;
			var location_id = self.searchModel.config.context.loc_id || localStorage.getItem("location_id");
			var product_id = self.searchModel.config.context.product_id;
			//sets location_id and company_id in local storage
			if (self.searchModel.config.context.loc_id != null) {
				localStorage.setItem("location_id", self.searchModel.config.context.loc_id);
				localStorage.setItem("company_id", self.searchModel.config.context.company_id);
			}

			var colorDiv = document.createElement("div");
			colorDiv.classList.add("rectangle");
			var color1 = document.createElement("div");
			color1.classList.add("square1");
			colorDiv.appendChild(color1);
			var colorText1 = document.createElement("div");
			colorText1.classList.add("squareText1");
			colorText1.innerHTML = "Overload";
			colorDiv.appendChild(colorText1);
			var color2 = document.createElement("div");
			color2.classList.add("square2");
			colorDiv.appendChild(color2);
			var colorText2 = document.createElement("div");
			colorText2.classList.add("squareText2");
			colorText2.innerHTML = "Almost Full";
			colorDiv.appendChild(colorText2);
			var color3 = document.createElement("div");
			color3.classList.add("square3");
			colorDiv.appendChild(color3);
			var colorText3 = document.createElement("div");
			colorText3.classList.add("squareText3");
			colorText3.innerHTML = "Free Space Available";
			colorDiv.appendChild(colorText3);
			var color4 = document.createElement("div");
			color4.classList.add("square4blue");
			colorDiv.appendChild(color4);
			var colorText4 = document.createElement("div");
			colorText4.classList.add("squareText4");
			colorText4.innerHTML = "No Product/Load";
			colorDiv.appendChild(colorText4);

			start();
			/**
			 * The complete working of fetching data and displaying 3D objects.
			 *
			 * @async
			 */
			async function start() {
				//creating a new three.scene
				scene = new THREE.Scene();
				scene.background = new THREE.Color(0xdfdfdf);
				clock = new THREE.Clock();
				camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 6000);
				camera.position.set(0, 200, 300)
				renderer = new THREE.WebGLRenderer({
					antialias: true
				});
				//setting size and pixel ratio for the renderer.
				renderer.setSize(window.innerWidth, window.innerHeight / 1.163);
				renderer.setPixelRatio(window.devicePixelRatio);
				renderer.render(scene, camera);
				var o_content = self.$('.o_content')
				o_content.append(renderer.domElement);
				self.$el.find('.o_content').append(colorDiv);
				controls = new THREE.OrbitControls(camera, renderer.domElement);
				const baseGeometry = new THREE.BoxGeometry(800, 0, 800);
				const baseMaterial = new THREE.MeshBasicMaterial({
					color: 0xffffff,
					transparent: false,
					opacity: 1,
					side: THREE.FrontSide,
				});
				const baseCube = new THREE.Mesh(baseGeometry, baseMaterial);
				scene.add(baseCube);
				group = new THREE.Group();

				if (product_id) {
					// Case 1: Rendering 3D view for a product.template
					await ajax.jsonRpc('/3Dstock/data/product_location', 'call', {
						'product_id': product_id,
						'company_id': self.searchModel.config.context.company_id || localStorage.getItem("company_id"),
					}).then(function(result) {
						data = result.locations;
						product_data = result.product;
					});

					if (Object.keys(data).length > 0) {
						// Product is assigned to one or more locations
						for (let [key, value] of Object.entries(data)) {
							if ((value[0] > 0) || (value[1] > 0) || (value[2] > 0) || (value[3] > 0) || (value[4] > 0) || (value[5] > 0)) {
								const geometry = new THREE.BoxGeometry(value[3], value[5], value[4]);
								geometry.translate(0, (value[5] / 2), 0);
								const edges = new THREE.EdgesGeometry(geometry);
								// Use a default color for the location box since we're not fetching stock quantity
								loc_color = 0x8c8c8c;
								loc_opacity = 0.5;
								material = new THREE.MeshBasicMaterial({
									color: loc_color,
									transparent: true,
									opacity: loc_opacity
								});
								mesh = new THREE.Mesh(geometry, material);
								const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
									color: 0x404040
								}));
								line.position.x = value[0];
								line.position.y = value[1];
								line.position.z = value[2];
								mesh.position.x = value[0];
								mesh.position.y = value[1];
								mesh.position.z = value[2];
								const loader = new THREE.FontLoader();
								loader.load('https://threejs.org/examples/fonts/droid/droid_sans_bold.typeface.json', function(font) {
									const textcolor = 0x000000;
									const textMat = new THREE.MeshBasicMaterial({
										color: textcolor,
										side: THREE.DoubleSide,
									});
									const textmessage = key;
									if (value[3] > value[4]) {
										textSize = (value[4] / 2) - (value[4] / 2.9);
									} else {
										textSize = (value[3] / 2) - (value[3] / 2.9);
									}
									const textshapes = font.generateShapes(textmessage, textSize);
									const textgeometry = new THREE.ShapeGeometry(textshapes);
									textgeometry.translate(0, ((value[5] / 2) - (textSize / (textSize - 1.5))), 0);
									const text = new THREE.Mesh(textgeometry, textMat);
									if (value[4] > value[3]) {
										text.rotation.y = Math.PI / 2;
										text.position.x = value[0];
										text.position.y = value[1];
										text.position.z = value[2] + (textSize * 2) + ((value[3] / 3.779 / 2) / 2) + (textSize / 2);
									} else {
										text.position.x = value[0] - (textSize * 2) - ((value[4] / 3.779 / 2) / 2) - (textSize / 2);
										text.position.y = value[1];
										text.position.z = value[2];
									}
									scene.add(text);
								});
								scene.add(mesh);
								scene.add(line);
								mesh.name = key;
								mesh.userData = {
									color: loc_color,
									loc_id: value[6],
								};
								group.add(mesh);

								// Create the product box inside this location
								const productBoxGeometry = new THREE.BoxGeometry(
									product_data.length || 10,
									product_data.height || 10,
									product_data.width || 10
								);
								productBoxGeometry.translate(0, (product_data.height || 10) / 2, 0);
								const productBoxMaterial = new THREE.MeshBasicMaterial({
									color: 0xff0000, // Red color to distinguish the product
									transparent: true,
									opacity: 0.7
								});
								const productBox = new THREE.Mesh(productBoxGeometry, productBoxMaterial);
								// Position the product box inside the location box
								const offsetX = product_data.pos_x || 0;
								const offsetY = product_data.pos_y || 0;
								const offsetZ = product_data.pos_z || 0;
								const productHeight = product_data.height || 10;
								productBox.position.set(
									value[0] + offsetX,
									value[1] + productHeight / 2 + offsetY,
									value[2] + offsetZ
								);
								productBox.visible = true;
								scene.add(productBox);
								group.add(productBox);

								// Add a small box inside the product box
								const smallBoxGeometry = new THREE.BoxGeometry(5, 5, 5);
								smallBoxGeometry.translate(0, 5 / 2, 0);
								const smallBoxMaterial = new THREE.MeshBasicMaterial({
									color: 0xff0000,
									transparent: true,
									opacity: 0.7,
									depthWrite: true,
									depthTest: true,
								});
								const smallBox = new THREE.Mesh(smallBoxGeometry, smallBoxMaterial);
								smallBox.position.set(
									value[0] + offsetX,
									value[1] + productHeight / 2 + offsetY + (5 / 2) + 0.1,
									value[2] + offsetZ
								);
								smallBox.visible = true;
								smallBox.userData = {
									isSmallBox: true,
									isProductSmallBox: true,
									productName: product_data.name,
									productId: product_data.id,
								};
								scene.add(smallBox);
								group.add(smallBox);
							}
						}
					} else {
						// Product is not assigned to any location, render it standalone
						const productBoxGeometry = new THREE.BoxGeometry(
							product_data.length || 10,
							product_data.height || 10,
							product_data.width || 10
						);
						productBoxGeometry.translate(0, (product_data.height || 10) / 2, 0);
						const productBoxMaterial = new THREE.MeshBasicMaterial({
							color: 0xff0000,
							transparent: true,
							opacity: 0.7
						});
						const productBox = new THREE.Mesh(productBoxGeometry, productBoxMaterial);
						const productHeight = product_data.height || 10;
						productBox.position.set(
							product_data.pos_x || 0,
							(product_data.pos_y || 0) + productHeight / 2,
							product_data.pos_z || 0
						);
						productBox.visible = true;
						scene.add(productBox);
						group.add(productBox);

						// Add a small box inside the standalone product box
						const smallBoxGeometry = new THREE.BoxGeometry(3, 3, 3);
						smallBoxGeometry.translate(0, 5 / 2, 0);
						const smallBoxMaterial = new THREE.MeshBasicMaterial({
							color: 0xff0000,
							transparent: true,
							opacity: 0.7,
							depthWrite: true,
							depthTest: true,
						});
						const smallBox = new THREE.Mesh(smallBoxGeometry, smallBoxMaterial);
						smallBox.position.set(
							product_data.pos_x || 0,
							(product_data.pos_y || 0) + productHeight / 2 + (3 / 2) + 0.1,
							product_data.pos_z || 0
						);
						smallBox.visible = true;
						smallBox.userData = {
							isSmallBox: true,
							isProductSmallBox: true,
							productName: product_data.name,
							productId: product_data.id,
						};
						scene.add(smallBox);
						group.add(smallBox);
					}
				} else {
					// Case 2: Rendering 3D view for a stock.location
					await ajax.jsonRpc('/3Dstock/data/standalone', 'call', {
						'company_id': self.searchModel.config.context.company_id || localStorage.getItem("company_id"),
						'loc_id': self.searchModel.config.context.loc_id || localStorage.getItem("location_id"),
					}).then(function(incoming_data) {
						data = incoming_data;
					});
					//traversing through each location object
					for (let [key, value] of Object.entries(data)) {
						//checks if the dimension values of the location are non zero
						if ((value[0] > 0) || (value[1] > 0) || (value[2] > 0) || (value[3] > 0) || (value[4] > 0) || (value[5] > 0)) {
							const geometry = new THREE.BoxGeometry(value[3], value[5], value[4]);
							geometry.translate(0, (value[5] / 2), 0);
							const edges = new THREE.EdgesGeometry(geometry);
							/**
							 * Make a jsonRpc call to fetch the stock details of particular location.
							 *
							 * @await
							 * @param {integer} loc_code
							 */
							await ajax.jsonRpc('/3Dstock/data/quantity', 'call', {
								'loc_code': key,
							}).then(function(quant_data) {
								loc_quant = quant_data;
							});
							//checking the quantity and capacity of the location to determine the color of the location
							if (localStorage.getItem("location_id") == value[6]) {
								if (loc_quant[0] > 0) {
									if (loc_quant[1] > 100) {
										loc_color = 0xcc0000;
										loc_opacity = 0.8;
									} else if (loc_quant[1] > 50) {
										loc_color = 0xe6b800;
										loc_opacity = 0.8;
									} else {
										loc_color = 0x00802b;
										loc_opacity = 0.8;
									}
								} else {
									if (loc_quant[1] == -1) {
										loc_color = 0x00802b;
										loc_opacity = 0.8;
									} else {
										loc_color = 0x0066ff;
										loc_opacity = 0.8;
									}
								}
							} else {
								loc_color = 0x8c8c8c;
								loc_opacity = 0.5;
							}
							//creating a 3D box geometry for each location
							material = new THREE.MeshBasicMaterial({
								color: loc_color,
								transparent: true,
								opacity: loc_opacity,
								depthWrite: true,
								depthTest: true,
							});
							mesh = new THREE.Mesh(geometry, material);
							const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
								color: 0x404040
							}));
							line.position.x = value[0];
							line.position.y = value[1];
							line.position.z = value[2];
							mesh.position.x = value[0];
							mesh.position.y = value[1];
							mesh.position.z = value[2];
							const loader = new THREE.FontLoader();
							loader.load('https://threejs.org/examples/fonts/droid/droid_sans_bold.typeface.json', function(font) {
								const textcolor = 0x000000;
								const textMat = new THREE.MeshBasicMaterial({
									color: textcolor,
									side: THREE.DoubleSide,
								});
								const textmessage = key;
								if (value[3] > value[4]) {
									textSize = (value[4] / 2) - (value[4] / 2.9);
								} else {
									textSize = (value[3] / 2) - (value[3] / 2.9);
								}
								const textshapes = font.generateShapes(textmessage, textSize);
								const textgeometry = new THREE.ShapeGeometry(textshapes);
								textgeometry.translate(0, ((value[5] / 2) - (textSize / (textSize - 1.5))), 0);
								const text = new THREE.Mesh(textgeometry, textMat);
								if (value[4] > value[3]) {
									text.rotation.y = Math.PI / 2;
									text.position.x = value[0];
									text.position.y = value[1];
									text.position.z = value[2] + (textSize * 2) + ((value[3] / 3.779 / 2) / 2) + (textSize / 2);
								} else {
									text.position.x = value[0] - (textSize * 2) - ((value[4] / 3.779 / 2) / 2) - (textSize / 2);
									text.position.y = value[1];
									text.position.z = value[2];
								}
								scene.add(text);
							});
							scene.add(mesh);
							scene.add(line);
							mesh.name = key;
							mesh.userData = {
								color: loc_color,
								loc_id: value[6],
							};
							group.add(mesh);

							// Fetch the number of products in this location
							let products = [];
							await ajax.jsonRpc('/3Dstock/data/product', 'call', {
								'loc_code': key,
							}).then(function(product_data) {
								console.log("Product data for location", key, ":", product_data);
								products = product_data.product_list || [];
							}).catch(function(error) {
								console.error("Error fetching product data for location", key, ":", error);
							});

							// Create boxes based on the number of products and their dimensions
							const numProducts = products.length;
							console.log("Number of products in location", key, ":", numProducts);
							const containerWidth = value[3]; // Location container width
							const containerDepth = value[4]; // Location container depth
							const containerHeight = value[5]; // Location container height

							// Fallback: If no products or an error occurred, create a single small box
							if (numProducts === 0) {
								console.log("No products found for location", key, ", creating a single small box as fallback");
								const smallBoxGeometry = new THREE.BoxGeometry(3, 3, 3);
								smallBoxGeometry.translate(0, 5 / 2, 0);
								const smallBoxMaterial = new THREE.MeshBasicMaterial({
									color: 0xff0000,
									transparent: true,
									opacity: 0.7,
									depthWrite: true,
									depthTest: true,
								});
								const smallBox = new THREE.Mesh(smallBoxGeometry, smallBoxMaterial);
								smallBox.position.set(
									value[0],
									value[1] + productHeight / 2 + offsetY + (3 / 2) + 0.1,
									value[2]
								);
								smallBox.visible = true;
								smallBox.userData = {
									isSmallBox: true,
									isLocationSmallBox: true,
									locCode: key,
								};
								scene.add(smallBox);
								group.add(smallBox);
								console.log("Created fallback small box at position:", smallBox.position.x, smallBox.position.y, smallBox.position.z);
							} else {
								// Dynamic creation of boxes based on product dimensions
								const scaleFactor = 0.4; // Scale down the box sizes to 40%
								let currentX = -(containerWidth / 2) + 1; // Start from the left edge of the container
								let currentY = value[1] + 0.1; // Start just above the container base
								let currentZ = -(containerDepth / 2) + 1; // Start from the front edge of the container
								const spacing = 2; // Spacing between boxes

								for (let i = 0; i < numProducts; i++) {
									const product = products[i];
									// Scale down the dimensions
									const boxWidth = (product[2] || 10) * scaleFactor;
									const boxHeight = (product[4] || 10) * scaleFactor;
									const boxDepth = (product[3] || 10) * scaleFactor;

									// Create a box with the scaled dimensions
									const productBoxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
									productBoxGeometry.translate(0, boxHeight / 2, 0);
									const productBoxMaterial = new THREE.MeshBasicMaterial({
										color: 0xff0000,
										transparent: true,
										opacity: 0.7,
										depthWrite: true,
										depthTest: true,
									});
									const productBox = new THREE.Mesh(productBoxGeometry, productBoxMaterial);

									// Position the box within the container using scaled dimensions
									if (currentX + boxWidth + spacing > containerWidth / 2) {
										// Move to the next row
										currentX = -(containerWidth / 2) + 1;
										currentZ += boxDepth + spacing;
									}
									if (currentZ + boxDepth + spacing > containerDepth / 2) {
										// Move to the next layer
										currentZ = -(containerDepth / 2) + 1;
										currentY += boxHeight + spacing;
									}
									if (currentY + boxHeight > value[1] + containerHeight) {
										// Stop adding boxes if they exceed the container height
										console.log("Stopped adding boxes for location", key, "as they exceed container height");
										break;
									}

									productBox.position.set(
										value[0] + currentX + (boxWidth / 2),
										currentY + (boxHeight / 2),
										value[2] + currentZ + (boxDepth / 2)
									);
									currentX += boxWidth + spacing;

									// Associate this box with the specific product
									productBox.visible = true;
									debugger
									productBox.userData = {
										isSmallBox: true,
										isLocationSmallBox: true,
										locCode: key,
										productName: product[0], // Store the product name
										productId: product[2], // Store the product id
									};
									scene.add(productBox);
									group.add(productBox);
									console.log("Created product box for", product[0], "at position:", productBox.position.x, productBox.position.y, productBox.position.z);
								}
							}
						}
					}
				}

				scene.add(group);
				raycaster = new THREE.Raycaster();
				pointer = new THREE.Vector3();
				animate();
			}
			/**
			 * Handles the resizing and setting the pixel ration on window resize.
			 */
			function onWindowResize() {
				camera.aspect = window.innerWidth / window.innerHeight;
				camera.updateProjectionMatrix();
				renderer.setSize(window.innerWidth, window.innerHeight / 1.163);
			}
			/**
			 * Animates and renders the three.renderer object to make changes on the scene.
			 */
			function animate() {
				requestAnimationFrame(animate);
				const delta = clock.getDelta();
				renderer.render(scene, camera);
				var canvas = document.getElementsByTagName("canvas")[0];
				var colorBox = document.querySelector(".rectangle");
				//checking the canvas element adding event listener on canvas.
				if (canvas == null) {
					window.removeEventListener('dblclick', onPointerMove);
					window.removeEventListener('resize', onWindowResize);
					if (colorBox) {
						colorBox.style.display = "none";
					}
				} else {
					window.addEventListener('dblclick', onPointerMove);
					window.addEventListener('resize', onWindowResize);
					if (colorBox) {
						colorBox.style.display = "block";
					}
				}
			}
			/**
			 * gets the coordinates of the mouse point and checks for any objects.
			 *
			 * @async
			 * @param {object} event
			 */
			async function onPointerMove(event) {
				var products;
				var button;
				if (dialogs == null) {
					if (selectedObject) {
						if (selectedObject.userData.color) {
							selectedObject.material.color.set(selectedObject.userData.color);
						}
						selectedObject = null;
					} else {
						pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
						pointer.y = -(event.clientY / (window.innerHeight)) * 2 + 1 + 0.13;
						raycaster.setFromCamera(pointer, camera);
						const intersects = raycaster.intersectObject(group, true);
						if (intersects.length > 0) {
							const res = intersects.filter(function(res) {
								return res && res.object;
							})[0];
							if (res && res.object) {
								if (res.object.userData.isSmallBox) {
									// Handle small box click
									if (res.object.userData.isProductSmallBox || res.object.userData.isLocationSmallBox) {
										// Open product.template form view as a popup for both product and location small boxes
										const productId = res.object.userData.productId;
										if (productId) {
											self.actionService.doAction({
												type: 'ir.actions.act_window',
												res_model: 'product.template',
												res_id: productId,
												views: [[false, 'form']],
												target: 'new', // Open as a dialog on the same page
											});
										}
									}
								} else {
									// Handle location box click (existing behavior)
									await ajax.jsonRpc('/3Dstock/data/product', 'call', {
										'loc_code': res.object.name,
									}).then(function(product_data) {
										products = product_data;
									});
									selectedObject = res.object;
									selectedObject.material.color.set(0x00ffcc);
									function onClickClose() {
										if (dialogs) {
											console.log("Closing location container dialog, dialogs:", dialogs);
											if (selectedObject) {
												selectedObject.material.color.set(selectedObject.userData.color);
												selectedObject = null;
											}
											dialogs.close();
											dialogs = null;
											window.removeEventListener('click', onClickClose);
										} else {
											console.log("Location container dialog already closed or null");
											if (selectedObject) {
												selectedObject.material.color.set(selectedObject.userData.color);
												selectedObject = null;
											}
											window.removeEventListener('click', onClickClose);
										}
									}
									// Remove any existing click listeners to prevent duplicates
									window.removeEventListener('click', onClickClose);
									dialogs = new PositionDialog(this, {
										title: ('Location: ' + res.object.name),
										size: 'small',
										$content: $(QWeb.render('ViewLocationData', {
											data: products,
										})),
										placement: 'bottom',
										renderFooter: false,
										pointer: {
											x: event.clientX,
											y: event.clientY,
										},
										close: onClickClose,
									}).open();

									if (dialogs) {
										window.addEventListener('click', onClickClose);
									}
								}
							}
						}
					}
				}
			}
		}

	});
	core.action_registry.add("open_form_3d_view", open_form_3d_view);
	return open_form_3d_view;
});