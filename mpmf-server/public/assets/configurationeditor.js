let ConfigurationEditor = function (configuration) {
	
	this.configuration = configuration;
	
};

function addToolTip(el){
	// tooltip
	var tooltip = d3.select("#tooltip");

	if(el.target.innerHTML == "Trigger"){
		var tooltipHTML = "Number of input components to </br> trigger a threshold breach";					
		tooltip.html(tooltipHTML);
		tooltip.style('left', (el.pageX+30) + 'px');
		tooltip.style('top', (el.pageY+10) + 'px');
		tooltip.style("visibility", "visible");
	}

	if(el.target.innerHTML == "Lower Threshold"){
		var tooltipHTML = "Lower limit to trigger a threshold breach";					
		tooltip.html(tooltipHTML);
		tooltip.style('left', (el.pageX+30) + 'px');
		tooltip.style('top', (el.pageY+10) + 'px');
		tooltip.style("visibility", "visible");
	}

	if(el.target.innerHTML == "Upper Threshold"){
		var tooltipHTML = "Upper limit to trigger a threshold breach";					
		tooltip.html(tooltipHTML);
		tooltip.style('left', (el.pageX+30) + 'px');
		tooltip.style('top', (el.pageY+10) + 'px');
		tooltip.style("visibility", "visible");
	}

	if(el.target.innerHTML == "Valve Start"){
		var tooltipHTML = "Start time in minutes </br> or fraction of minutes";					
		tooltip.html(tooltipHTML);
		tooltip.style('left', (el.pageX+30) + 'px');
		tooltip.style('top', (el.pageY+10) + 'px');
		tooltip.style("visibility", "visible");
	}

	if(el.target.innerHTML == "Valve End"){
		var tooltipHTML = "End time in minutes </br> or fraction of minutes";					
		tooltip.html(tooltipHTML);
		tooltip.style('left', (el.pageX+30) + 'px');
		tooltip.style('top', (el.pageY+10) + 'px');
		tooltip.style("visibility", "visible");
	}
}

function removeToolTip(el){
	d3.select("#tooltip").style("visibility", "hidden");
}

ConfigurationEditor.start = function (experiment, configuration, btnSaveCallback, update, machine) {

	let configurationEditor = new ConfigurationEditor(configuration);
	
	let body = document.getElementsByTagName("body")[0];
	
	// add configuration editor div
	let divConfigEditor = document.createElement("div");
	divConfigEditor.id = "config-editor-" + experiment;
	divConfigEditor.style.opacity = 0;
	if(experiment == "Processing"){
		divConfigEditor.style.width = "30%";
	}
	if(experiment == "Instruments"){
		divConfigEditor.style.width = "60%";
	}
	divConfigEditor.className = "config-editor container-fluid";
	body.appendChild(divConfigEditor);

	// add header div "QC Configuration"
	let divConfigEditorHeader = document.createElement("h2");
	divConfigEditorHeader.className = "config-editor-header";
	divConfigEditorHeader.style.letterSpacing = "4px";
	// Instruments, Proteomics, Metabolomics, Processing, (machine + Metab/Prot)
	if(experiment == "Processing"){
		divConfigEditorHeader.innerText = "";
	}
	else if(machine != ""){
		divConfigEditorHeader.innerText = machine + " " + experiment + " Configuration";
	}
	else{
		divConfigEditorHeader.innerText = experiment + " Configuration";
	}
	divConfigEditor.appendChild(divConfigEditorHeader);
	
	
	let divParameters = document.createElement("div");
	divParameters.id = "parameters-" + experiment;
	divParameters.style.letterSpacing = "2px";
	divParameters.className = "parameters";
	divConfigEditor.appendChild(divParameters);
	

	// use jsGrid (http://js-grid.com/) to show the different sections of the configuration
	// for each section of the configuration
	for (let key of Object.keys(configuration)) {
		let parameters = configuration[key];
		let divName = document.createElement("div");
		divName.id = key + "-name-" + experiment;
		divName.className = "parameters-name";
		divName.innerText = parameters.name;

		// hide this section for instruments on reconfig
		if(experiment == "Instruments"){
			divName.style.width = "0px";
			divName.style.padding = "0px";
		}
		divParameters.appendChild(divName);
		
		
		// add jsGrid div
		let divParametersGrid = document.createElement("div");
		divParametersGrid.id = key + "-grid-" + experiment;
		divParametersGrid.addEventListener("mouseover", addToolTip);
		divParametersGrid.addEventListener("mouseout", removeToolTip);
		divParameters.appendChild(divParametersGrid);
		$("#" + key + "-grid-" + experiment).jsGrid({
			width: "100%",
			inserting: parameters["grid-configuration"].inserting,
			//heading: parameters["grid-configuration"].heading,
			editing: true,
			fields: parameters.fields,
			data: parameters.settings,
			onItemInserting: function(args) {
				if(args.item["Custom"] !== undefined){
					args.item["Custom"] = "<button data-name=" + args.item["Name"] + " onclick='loadCustom()' " + " style='font-size:2vh' class='btn btn-dark custom'>Customize</button>";
				}

				// valid names only
				if(args.item.Name != undefined){
					let pattern = /^[a-z0-9_-]+$/i;
					if(args.item.Name.match(pattern) == null){
						args.cancel = true;
						alert("Names must be alphanumeric, hyphens or underscore. No Spaces or other characters allowed.");
					};
				};

				// unique names (instrumnets and components)
				if(args.item["mz"] !== undefined || args.item["Type"] !== undefined){
					for(let row in args.grid.data){
						if(args.grid.data[row]['Name'] == args.item['Name']){
							args.cancel = true;
							alert("No duplicate names allowed.")
						}
					}
				}

				// restrict to 15 components
				if(args.item["mz"] !== undefined){
					if(experiment == "Proteomics"){
						if(args.grid.data.length >= 15){
							args.cancel = true;
							alert("Maximum 15 input peptides allowed.")
						}
					}
					else{
						// count polarity
						var negPol = 0;
						var posPol = 0;
						for(let row in args.grid.data){
							if(args.grid.data[row]['Polarity'] == 1){
								posPol += 1;
							}else if(args.grid.data[row]['Polarity'] == 2){
								negPol += 1;
							}
						}

						if(args.item['Polarity'] == 1){
							if(posPol >= 15){
								args.cancel = true;
								alert("Maximum 15 positive metabolites allowed.")
							}
						}
						else{
							if(negPol >= 15){
								args.cancel = true;
								alert("Maximum 15 negative metabolites allowed.")
							}
						}
					}
				}
				
			},
			onItemUpdating: function(args){
			
				// valid names only
				if(args.item.Name != undefined){
					let pattern = /^[a-z0-9_-]+$/i;
					if(args.item.Name.match(pattern) == null){
						args.cancel = true;
						alert("Names must be alphanumeric, hyphens or underscore. No Spaces or other characters allowed.");
					};
				};
				
				// unique names (instruments and components)
				/* FIX: Temp removed, causes incorrect catch when updating custom machines
				/* 		Found a way to handle this, (separate files, add index number??)
				
				if(args.item["mz"] !== undefined || args.item["Type"] !== undefined && args.item["Use Proteomics"] == undefined){
					for(let row in args.grid.data){
						if(args.grid.data[row]['Name'] == args.item['Name']){
							console.log(args);
							args.cancel = true;
							alert("No duplicate names allowed updating.")
						}
					}
				}
				*/

				// check for ppm lower and upper
				if(args.item.Metric == "Mass Error (ppm)"){
					if(args.item["Lower Threshold"] == ""){
						args.cancel = true;
						alert("Mass Error (ppm) needs a lower threshold");
					};
					if(args.item["Upper Threshold"] == ""){
						args.cancel = true;
						alert("Mass Error (ppm) needs a upper threshold");
					};
				};

				// no upper
				var no_upper = ["Area Normalised", "Target PSMs (percentile)", "Unique Target Peptides (percentile)",
								"Target Protein Groups (percentile)", "MS/MS Spectra (percentile)"];
				if(no_upper.includes(args.item.Metric)){
					if(args.item["Upper Threshold"] != ""){
						args.cancel = true;
						alert("No upper threshold allowed for this metric");
					};
				}

				// no lower
				var no_lower = ["Full Width Half Maximum (seconds)", "Tailing Factor (seconds)", "Asymmetry Factor (seconds)"];
				if(no_lower.includes(args.item.Metric)){
					if(args.item["Lower Threshold"] != ""){
						args.cancel = true;
						alert("No lower threshold allowed for this metric");
					};
				}
			}
		});
	
	}

	// add footer div for the button
	let divConfigEditorFooter = document.createElement("div");
	divConfigEditorFooter.className = "config-editor-footer";
	divConfigEditor.appendChild(divConfigEditorFooter);

	// add button
	let btnSave = document.createElement("button");
	if(update){
		btnSave.innerHTML = "Update " + experiment;	
	}
	else{
		btnSave.innerHTML = "Save " + experiment;
	}

	if(machine != ""){
		btnSave.innerHTML = "Customize " + machine + " " + experiment;
	}

	if(experiment == "Processing"){
		btnSave.innerHTML = "<span class='fas fa-flask'></span> Process";
		btnSave.className = "btn btn-outline-info";
		btnSave.style.fontSize = "2vh";

		// add div for output
		let output = document.createElement("p");
		output.style.id = "output";
		body.appendChild(output);
	}
	else{
		btnSave.className = "btn btn-info";
		btnSave.style.fontSize = "2vh";
	}
	
	btnSave.style.padding = "5px";
	btnSave.style.letterSpacing = "0.2vh";
	btnSave.onclick = btnSaveCallback;
	divConfigEditorFooter.appendChild(btnSave);

	d3.select("#config-editor-"+ experiment).transition().duration(1200).style("opacity", 1);

	return configurationEditor;

}

ConfigurationEditor.prototype.end = function () {

	return this.configuration;
	
}
