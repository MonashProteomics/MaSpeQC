let simulation; // define globally for updates
let forceWidth;
let forceHeight;
let reStartSim; // just redraw

function draw_force_main(transition){
    // get width and height of plot area
    var plot_area = document.getElementById("plot_chart");
    var chart_bottom = document.getElementById("chart_bottom");
    var chart_top = document.getElementById("chart_top");
    var plot_height = plot_area.offsetHeight;
    var plot_width = plot_area.offsetWidth;

    // set the dimensions and margins of the graph
    var margin = {top: chart_top.offsetHeight, right: 0, bottom: chart_bottom.offsetHeight, left: 0};
    forceWidth = plot_width - margin.left - margin.right;
    forceHeight = plot_height - margin.top - margin.bottom;
    
    // remove top and bottom controls (OLD)
    //chart_top.style.display = "none";
    //chart_bottom.style.display = "none";
    plot_area.style.opacity = 1;

    // remove any elements in plot area
    while (plot_area.firstChild) {
        plot_area.removeChild(plot_area.firstChild);
    }

    mainForce = true; // just in case!

    // update header
    var chart_header = document.getElementById("chartHeader");
    chart_header.innerHTML = "ALL METRICS";

    // append the svg object to the plot area
    var svg = d3.select("#plot_chart")
    .append("svg")
        .attr("width", plot_width)
        .attr("height", plot_height)
        //.attr("filter", function(){
            //if(theme == "dark"){return "url(#backLightDark)";}
            //return "url(#backLightDark)";
        //})
    .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    // expand/contract icons
    if(controls){
        var linkRef = "#expandIcon";
        var linkTip = "Hide Controls";
    }
    else{
        var linkRef = "#contractIcon";
        var linkTip = "Show Controls";
    }
    
    // add icon
    svg
    .append("use")
    .attr("id", "chartIcon")
    .attr("xlink:href", linkRef)
    .attr("x", "95%")
    .attr("y", "10%")
    .attr("width", 2*v_width_unit)
    .attr("height", 2*v_width_unit)
    .style("fill", function(){
        if(theme == "dark"){return "white"}
        return "var(--dark)";
    })
    .style("cursor","pointer")
    .on("mouseover", function(event){
        var tooltip = d3.select("#tooltip");
        tooltip.html(linkTip);
        tooltip.style('left', (event.pageX - 10*v_height_unit) + 'px');
        tooltip.style('top', (event.pageY - 5*v_height_unit) + 'px');
        tooltip.style("visibility", "visible");

    })
    .on("mouseout", function(event){
        var tooltip = d3.select("#tooltip");
        tooltip.style("visibility", "hidden");
    })
    .on("click", function(event){
        var tooltip = d3.select("#tooltip");
        tooltip.style("visibility", "hidden");
        changeControls();
    });

    // background
    /*
    svg.
    append("rect")
        .attr("id", "backLineForce")
        .attr("width", forceWidth)
        .attr("height", forceHeight)
        .attr("class", function(){
            if(theme == "dark"){return "darkTheme";}
            return "lightTheme";
        })
        .attr("filter", function(){
            if(theme == "dark"){return "url(#backLightDark)";}
            return "url(#backLightDark)";
        })
        .attr("x",0)
        .attr("y",0);
        */

    // reset highlight
    svg.on("dblclick", function(d){
        d3.selectAll(".nodes").style("opacity", 1);
        d3.selectAll(".links").style("opacity", 1);
    })

    var gradFill = svg
    .append('defs')
    .append('linearGradient')
    .attr('id', 'middleCircleFill')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%')

    gradFill.append('stop')
    .attr('offset', '0%')
    .style('stop-color', "whitesmoke")
    .style('stop-opacity', 1);

    gradFill.append('stop')
    .attr('offset', '50%')
    .style('stop-color', 'lightgrey')
    .style('stop-opacity', 1);

    gradFill.append('stop')
    .attr('offset', '100%')
    .style('stop-color', 'grey')
    .style('stop-opacity', 1);

    // get graph
    var graph = getGraph(forceWidth, forceHeight);
    
    // scales for each metric
    var edgeScales = {};
    for(let j in machine_data.lcms_metrics){
        var newScale = d3.scaleLinear()
                        .range([4*currentRadius, 0.3*forceHeight])
                        .clamp(true);

        if(machine_data.lcms_metrics[j].display_name == "Mass Error (ppm)"){
            newScale.domain([0, 4]);
        }
        else if(machine_data.lcms_metrics[j].display_name == "Mass Error (mDa)"){
            newScale.domain([0, 3]);
        }
        else if(machine_data.lcms_metrics[j].display_name == "Tailing"){
            newScale.domain([0, 2]);
        }
        else if(machine_data.lcms_metrics[j].display_name == "Asymmetry"){
            newScale.domain([0, 2]);
        }
        else if(machine_data.lcms_metrics[j].display_name == "Retention Time"){
            newScale.domain([0, 2]);
        }
        else if(machine_data.lcms_metrics[j].display_name == "Full Width Half Maximum"){
            newScale.domain([0, 10]);
        }
        else if(machine_data.lcms_metrics[j].display_name == "Area (normalised)"){
            newScale.domain([0, 3]);
        }
        else if(machine_data.lcms_metrics[j].display_name == "Height (normalised)"){
            newScale.domain([0, 3]);
        }
        edgeScales[machine_data.lcms_metrics[j].metric_id] = newScale;
    }
    
    // boundary edge constraint (account for icon)
    var simEdge = currentRadius + v_width_unit;

    // simulation constraints
    simulation = d3.forceSimulation().alpha(1).alphaDecay(0.1).velocityDecay(0.4)
    .force("link", d3.forceLink().strength(2).id(function(d) { return d.id; }))
    //.force("charge", d3.forceManyBody())
    .force("boundary", forceBoundary(simEdge, simEdge, forceWidth-simEdge, forceHeight-simEdge).strength(0.005))
    .force("collide", d3.forceCollide().radius(function(d){
        if(d.nodeType == 2){
            return d.radius + lineWidth;
        }
        return d.radius;
    }));
    //.force("center", d3.forceCenter(forceWidth / 2, forceHeight / 2));

    // Text background (add/remove text for bounding box)
    var text = svg.append("g")
    .selectAll("headers")
    .data(graph.nodes)
    .enter().append("text")
    .text(function(d){
        if(d.nodeType == 2){
            return d.name.toUpperCase();
        }
        return "";
    })
    .style("text-anchor", "middle")
    .attr("class", "names label-force")
    .call(getBB);

    // Remove the text elements
    d3.selectAll(".names").remove();
    
    // add rects
    const xMargin = 6;
    const yMargin = 4;
    var rects = svg
    .selectAll("rect")
    .data(graph.nodes)
    .enter()
    .append("rect")
    .attr("class", "background_rect")
    .attr("x", d => d.x - d.bbox.width/2)
    .attr("y", d => d.y + currentRadius*8)
    .attr("rx", 5)
    .attr("ry", 2)
    .attr("width", d => d.bbox.width + 2 * xMargin)
    .attr("height", d => d.bbox.height + 2 * yMargin)
    .attr("fill", function(){
        if(theme == "dark"){return "black";}
        return "black";
    })
    .attr("stroke", function(){
        if(theme == "dark"){return "var(--info)";}
        return "var(--info)";
    })
    .attr("stroke-width", "2")
    .style("fill-opacity", function(d){
        if(d.nodeType == 2){
            return 0.8;
        }
        return 0;
    })
    .style("stroke-opacity", function(d){
        if(d.nodeType == 2){
            return 1;
        }
        return 0;
    })
    .attr('transform', function(d) {
        return `translate(-${xMargin}, -${d.bbox.height * 0.8 + yMargin})`
        });

    // add text
    var text = svg.append("g")
    .selectAll("headers")
    .data(graph.nodes)
    .enter().append("text")
    .attr("cursor", "pointer")
    .on("click", function(event ,d){
        var chart_bottom = document.getElementById("chart_bottom");
        var chart_top = document.getElementById("chart_top");
        if(controls){
            chart_top.style.display = "block";
            chart_bottom.style.display = "block";
        }
        mainForce = false;
        chart_type = "line";
        metric_type = "lcms";
        display_metric = d.name;
        updateRadiosLineChart(display_metric);
        draw_line_chart(true);

        // enable scale buttons
        var scale_buttons = document.getElementsByName("scale-buttons");
        for(let i = 0; i<scale_buttons.length; i++){
                scale_buttons[i].disabled = false;
                scale_buttons[i].style.boxShadow = "gray 0.2em 0.2em 0.4em";
                scale_buttons[i].classList = "btn btn-custom";
        }

        // enable run buttons
        var run_buttons = document.getElementsByName("run-buttons");
        for(let i = 0; i<run_buttons.length; i++){
            run_buttons[i].disabled = false;
            run_buttons[i].style.boxShadow = "gray 0.2em 0.2em 0.4em";
            run_buttons[i].classList = "btn btn-custom";
        }

        create_components_menu(false);
    })
    .attr("class", "names label-force")
    .text(function(d){
        if(d.nodeType == 2){
            return d.name.toUpperCase();
        }
        return "";
    })
    .attr("fill", function(){
        if(theme == "dark"){return "white";}
        return "white";
    })
    .attr("stroke", function(){
        if(theme == "dark"){return "white";}
        return "white";
    })
    .attr("dy", currentRadius*8)
    //.style("font-weight", 500)
    .style("text-anchor", "middle");

    simulation
      .nodes(graph.nodes)
      .on("tick", ticked);

    simulation.force("link")
        .links(graph.links)
        .distance(function(d){
            if(d.linkType == 1){
                return 100;
            }
            return edgeScales[d.linkScale](d.value);
        });

    // add links
    var link = svg.append("g")
    .selectAll("line")
    .data(graph.links)
    .enter().append("line")
    .attr("class", "links")
      .attr("stroke-width", lineWidth)
      .style("stroke-opacity", 0.3)
      .attr("fill", "none")
      .attr("stroke", function(d){
        return d.colour;
      })
      .style("opacity", function(d){
        if(d.linkType == 1){
            return 0;
        }
        return 1;
      });

    // add nodes
    var node = svg.append("g")
    .selectAll("circle")
    .data(graph.nodes)
    .enter().append("circle")
    .attr("class", "nodes")
    .attr("r", d => d.radius)
    .attr("filter", function(d){
        if(d.nodeType != 2){return "url(#specular)"}
        //return "url(#specular)";
    })
    .attr("fill", function(d){
        if(d.nodeType == 2){
            //if(theme == "dark"){return "var(--dark)"}
            //return "white" ;
        return "url(#middleCircleFill)";
        }

        var miss = machine_data.components[d.cIndex].lcms_metrics[d.metricName].missing;
        if(miss.includes(run_index)){
            return "var(--dark)";
        }else{
            return d.colour; //'url(#circleGradLight'+d.comp+')'; 
        } 
        
    })
    .attr("stroke", function(d){
        if(d.nodeType ==2){
            //if(theme == "dark"){return "white"}
            //return "var(--dark)" ;//d.colour;
            //return "url(#middleCircleFill)";
            return "whitesmoke";
        }
        return d.colour;
        
    })
    .attr("stroke-width", lineWidth)
    .style("stroke-opacity", function(d){
        if(d.nodeType == 3){
            return 0.5;
        }
        return 0.5;
    })
    .style("fill-opacity", function(d){
        if(d.nodeType == 3){
            return 1;
        }
        return 1;
    })
    .attr("cursor", "pointer")
    .on("click", function(event, d){
        
        if(d.nodeType == 2){return;}

        // highlight nodes
        d3.selectAll(".nodes").style("opacity", function(e){
            if(e.name == d.name){return 1;}
            if(e.nodeType == 2){return 1;}
            return 0.05;
        });

        // highlight links
        //d3.selectAll(".links").style("opacity", function(e){
            //if(e.targetName == d.name){return 1;}
            //return 1;
        //});

        comp_index = d.cIndex;
        draw_chromatogram(true);
    })
    .on("mouseover", function(event, d){
        
        if(d.nodeType == 2){return;}

        // add tool as text
        svg.append("text")
        .attr("class", "hover-text")
        .attr("x",(d.x+10))
        .attr("y", (d.y+10))
        .attr("dy", "1em")
        .attr("font-size", "1.2em")
        .attr("fill", function(){
            if(theme == "dark"){return "white";}
            return "var(--dark)";
        })
        .attr("stroke", function(){
            if(theme == "dark"){return "white";}
            return "var(--dark)";
        })
        .style("text-shadow", "0.1vh 0.1vh gray")
        .text(d.name);

        var miss = machine_data.components[d.cIndex].lcms_metrics[d.metricName].missing;
        if(miss.includes(run_index)){
            var newText = "NO VALUE";
        }
        else{
            var newText = d.actualValue.toFixed(2);
        }

        // add tool as text
        svg.append("text")
        .attr("class", "hover-text")
        .attr("x",(d.x+10))
        .attr("y", (d.y+10 + 2*v_height_unit))
        .attr("dy", "1em")
        .attr("font-size", "1em")
        .attr("fill", function(){
            if(theme == "dark"){return "white";}
            return "var(--dark)";
        })
        .attr("stroke", function(){
            if(theme == "dark"){return "white";}
            return "var(--dark)";
        })
        .style("text-shadow", "0.1vh 0.1vh gray")
        .text(newText);

    })
    .on("mouseout", function(event, d){
        d3.selectAll(".hover-text").remove();
    })
    .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));

    // add averages
    var averages = svg.append("g")
    .selectAll("averages")
    .data(graph.nodes)
    .enter().append("text")
    .attr("class", "averages label-average")
    .text(function(d){
        d3.selectAll(".nodes").filter(e => e.metricName == d.metricName);
        if(d.nodeType == 2){
            var totalActual = 0;
            var total = 0;
            var nodeCount = 0;
            d3.selectAll(".nodes").filter(e => e.metricName == d.metricName && e.nodeType != 2).
            each(function(f){
                totalActual += f.actualValue;
                total += f.value;
                nodeCount += 1;
            })

            var absMetrics = ["Mass Error (ppm)", "Area (normalised)", 
                            "Height (normalised)", "Mass Error (mDa)",
                            "Retention Time", "Full Width Half Maximum"]
            if(absMetrics.includes(d.metricName)){
                d.current = (total/nodeCount).toFixed(2);
                return (total/nodeCount).toFixed(2);
            }
            else{
                d.current = (total/nodeCount).toFixed(2);
                return (total/nodeCount).toFixed(2); // asyym and tailing (same atm)
            }
        }
        return "";
        
    })
    .style("text-anchor", "middle")
    .style("dominant-baseline", function(d){
        if(d.metricName == 'Area (normalised)' || d.metricName == 'Height (normalised)'){
            return "middle";
        }
    })
    .attr("fill", function(){
        return "var(--dark)";
    })
    .attr("stroke", function(){
        return "var(--dark)";
    });

    // add units
    var units = svg.append("g")
    .selectAll("units")
    .data(graph.nodes)
    .enter().append("text")
    .attr("class", "units label-average")
    .text(function(d){
        if(d.nodeType == 2){
            return d.unit;
        }
        return "";
        
    })
    .attr("dy", 1.5*currentRadius)
    .style("text-anchor", "middle")
    .attr("fill", function(){
        return "var(--dark)";
    })
    .attr("stroke", function(){
        return "var(--dark)";
    });

    // add warning icons
    var icon = svg.append("g")
    .selectAll("icons")
    .data(graph.nodes).enter()
    .append("use")
    .attr("class", "icons")
    //.attr("filter", "url(#specular)")
    .attr("xlink:href", "#warningIcon")
    .attr("width", currentRadius*2)
    .attr("height", currentRadius*2)
    .style("opacity", function(d,i){

        // only comp nodes
        if(d.nodeType == 2){
            return 0;
        }

        // get thresholds (all)
        var thresh_metrics = {};
        if(metric_type == "lcms"){
            var thresh_metrics = machine_data.run_data[run_index].summary;
        }
        
        // get thresholds per metric
        var thresh_comp = {};
        for(let t in thresh_metrics){
            if(metab_metric_names[t] == d.metricName){
                thresh_comp = thresh_metrics[t];
            }
        }

        // show
        if(d.name in thresh_comp){
            return 1
        }
        return 0;
       
    });

    // get bb of text
    function getBB(selection) {
        selection.each(function(d){d.bbox = this.getBBox();})
    }

    // ticked function
    function ticked() {
        link
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });
    
        node
            .attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });

        text
            .attr("x",  d => d.x)
            .attr("y", d => d.y);

        averages
            .attr("x",  d => d.x)
            .attr("y", d => d.y);

        units
            .attr("x",  d => d.x)
            .attr("y", d => d.y);

        icon
            .attr("x",  d => d.x)
            .attr("y", d => d.y);

        rects
        .attr("x", d => d.x - d.bbox.width/2)
        .attr("y", d => d.y + currentRadius*8);
      }

      // just redrawing ATM, much easier
      reStartSim = function(graph) {
        // https://bl.ocks.org/mbostock/1095795
        // nodes
        // got to be a better way than this ?? YES! redraw

        // remove and re-add text so moves (plus bounding box for rects)
        d3.selectAll(".names").remove();
        d3.selectAll(".background_rect").remove();

        // Text background (add/remove text for bounding box)
        text = svg.append("g")
        .selectAll("headers")
        .data(graph.nodes)
        .enter().append("text")
        .text(function(d){
            if(d.nodeType == 2){
                return d.name.toUpperCase();
            }
            return "";
        })
        .style("text-anchor", "middle")
        .attr("class", "names label-force")
        .call(getBB);

        d3.selectAll(".names").remove(); // remove again

        // add background rects
        const xMargin = 6;
        const yMargin = 4;
        rects = svg
        .selectAll("rect")
        .data(graph.nodes)
        .enter()
        .append("rect")
        .attr("class", "background_rect")
        .attr("x", d => d.x - d.bbox.width/2)
        .attr("y", d => d.y + currentRadius*8)
        .attr("rx", 5)
        .attr("ry", 2)
        .attr("width", d => d.bbox.width + 2 * xMargin)
        .attr("height", d => d.bbox.height + 2 * yMargin)
        .attr("fill", function(){
            if(theme == "dark"){return "black";}
            return "black";
        })
        .attr("stroke", function(){
            if(theme == "dark"){return "var(--info)";}
            return "var(--info)";
        })
        .attr("stroke-width", "2")
        .style("fill-opacity", function(d){
            if(d.nodeType == 2){
                return 0.7;
            }
            return 0;
        })
        .style("stroke-opacity", function(d){
            if(d.nodeType == 2){
                return 1;
            }
            return 0;
        })
        .attr('transform', function(d) {
            return `translate(-${xMargin}, -${d.bbox.height * 0.8 + yMargin})`
            });
        
        text = svg.append("g")
        .selectAll("headers")
        .data(graph.nodes)
        .enter().append("text")
        .attr("cursor", "pointer")
        .on("click", function(event, d){
            var chart_bottom = document.getElementById("chart_bottom");
            var chart_top = document.getElementById("chart_top");
            if(controls){
                chart_top.style.display = "block";
                chart_bottom.style.display = "block";
            }
            mainForce = false;
            chart_type = "line";
            metric_type = "lcms";
            display_metric = d.name;
            updateRadiosLineChart(display_metric);
            draw_line_chart(true);

            // enable scale buttons
            var scale_buttons = document.getElementsByName("scale-buttons");
            for(let i = 0; i<scale_buttons.length; i++){
                    scale_buttons[i].disabled = false;
                    scale_buttons[i].style.boxShadow = "gray 0.2em 0.2em 0.4em";
                    scale_buttons[i].classList = "btn btn-custom";
            }

            // enable run buttons
            var run_buttons = document.getElementsByName("run-buttons");
            for(let i = 0; i<run_buttons.length; i++){
                run_buttons[i].disabled = false;
                run_buttons[i].style.boxShadow = "gray 0.2em 0.2em 0.4em";
                run_buttons[i].classList = "btn btn-custom";
            }

            create_components_menu(false);
        })
        .attr("class", "names label-force")
        .text(function(d){
            if(d.nodeType == 2){
                return d.name.toUpperCase();
            }
            return "";
        })
        .attr("fill", function(){
            if(theme == "dark"){return "white";}
            return "white";
        })
        .attr("stroke", function(){
            if(theme == "dark"){return "white";}
            return "white";
        })
        .attr("dy", currentRadius*8)
        //.style("font-weight", 500)
        .style("text-anchor", "middle");

        // add averages
        d3.selectAll(".averages").remove();
        averages = svg.append("g")
        .selectAll("averages")
        .data(graph.nodes)
        .enter().append("text")
        .attr("class", "averages label-average")
        .text(function(d){
            d3.selectAll(".nodes").filter(e => e.metricName == d.metricName);
            if(d.nodeType == 2){
                var totalActual = 0;
                var total = 0;
                var nodeCount = 0;
                d3.selectAll(".nodes").filter(e => e.metricName == d.metricName && e.nodeType != 2).
                each(function(f){
                    totalActual += f.actualValue;
                    total += f.value;
                    nodeCount += 1;
                })

                var absMetrics = ["Mass Error (ppm)", "Area (normalised)", 
                                "Height (normalised)", "Mass Error (mDa)",
                                "Retention Time", "Full Width Half Maximum"]
                if(absMetrics.includes(d.metricName)){
                    d.current = (total/nodeCount).toFixed(2);
                    return (total/nodeCount).toFixed(2);
                }
                else{
                    d.current = (total/nodeCount).toFixed(2);
                    return (total/nodeCount).toFixed(2); // asyym and tailing (same atm)
                }
            }
            return "";
            
        })
        .style("text-anchor", "middle")
        .style("dominant-baseline", function(d){
            if(d.metricName == 'Area (normalised)' || d.metricName == 'Height (normalised)'){
                return "middle";
            }
        })
        .attr("fill", function(){
            return "var(--dark)";
        })
        .attr("stroke", function(){
            return "var(--dark)";
        });
        
        // add units
        d3.selectAll(".units").remove();
        units = svg.append("g")
        .selectAll("units")
        .data(graph.nodes)
        .enter().append("text")
        .attr("class", "units label-average")
        .text(function(d){
            if(d.nodeType == 2){
                return d.unit;
            }
            return "";
            
        })
        .attr("dy", 1.5*currentRadius)
        .style("text-anchor", "middle")
        .attr("fill", function(){
            return "var(--dark)";
        })
        .attr("stroke", function(){
            return "var(--dark)";
        });

        // HERE: redraw of nodes and links over
        //       All force updates to ptoteomics
        node = node.data(graph.nodes, function(d) { return d.id;});
        node.exit().remove();
        node = node.enter()
        .append("circle")
        .attr("fill", function(d){
            if(d.nodeType == 2){
                //if(theme == "dark"){return "var(--dark)"}
                //return "white" ;
                return "url(#middleCircleFill)";
            }

            var miss = machine_data.components[d.cIndex].lcms_metrics[d.metricName].missing;
            if(miss.includes(run_index)){
                return "var(--dark)";
            }else{
                return d.colour; //'url(#circleGradLight'+d.comp+')'; 
            } 
        })
        .attr("stroke", function(d){
            if(d.nodeType ==2){
                //if(theme == "dark"){return "white"}
                //return "var(--dark)" ;//d.colour;
                //return "url(#middleCircleFill)";
                return "whitesmoke";
            }
            return d.colour;
            
        })
        .attr("class", "nodes")
        .attr("stroke-width", lineWidth)
        .style("stroke-opacity", function(d){
            if(d.nodeType == 3){
                return 0.5;
            }
            return 0.5;
        })
        .attr("r", d => d.radius)
        .attr("filter", "url(#specular)")
        .attr("cursor", "pointer")
        .on("click", function(event, d){
            if(d.nodeType == 2){return;}

            // highlight nodes
            d3.selectAll(".nodes").style("opacity", function(e){
                if(e.name == d.name){return 1;}
                if(e.nodeType == 2){return 1;}
                return 0.05;
            });

            // highlight links
            //d3.selectAll(".links").style("opacity", function(e){
                //if(e.targetName == d.name){return 1;}
                //return 0.05;
           // });

            // update chromatogram
            comp_index = d.cIndex;
            draw_chromatogram(true);
        })
        .on("mouseover", function(event, d){
            if(d.nodeType == 2){return;}
    
            // add tool as text
            svg.append("text")
            .attr("class", "hover-text")
            .attr("x",(d.x+10))
            .attr("y", (d.y+10))
            .attr("dy", "1em")
            .attr("font-size", "1.2em")
            .attr("fill", function(){
                if(theme == "dark"){return "white";}
                return "var(--dark)";
            })
            .attr("stroke", function(){
                if(theme == "dark"){return "white";}
                return "var(--dark)";
            })
            .style("text-shadow", "0.1vh 0.1vh gray")
            .text(d.name);

            var miss = machine_data.components[d.cIndex].lcms_metrics[d.metricName].missing;
            if(miss.includes(run_index)){
                var newText = "NO VALUE";
            }
            else{
                var newText = d.actualValue.toFixed(2);
            }
    
            // add tool as text
            svg.append("text")
            .attr("class", "hover-text")
            .attr("x",(d.x+10))
            .attr("y", (d.y+10 + 2*v_height_unit))
            .attr("dy", "1em")
            .attr("font-size", "1em")
            .attr("fill", function(){
                if(theme == "dark"){return "white";}
                return "var(--dark)";
            })
            .attr("stroke", function(){
                if(theme == "dark"){return "white";}
                return "var(--dark)";
            })
            .style("text-shadow", "0.1vh 0.1vh gray")
            .text(newText);
    
        })
        .on("mouseout", function(event, d){
            d3.selectAll(".hover-text").remove();
        })
        .merge(node)
        .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));
    
      
        //  links.
        link = link.data(graph.links, function(d) { return d.source.id + "-" + d.target.id; });
        link.exit().remove();
        link = link.enter()
        .append("line")
        .attr("stroke", function(d){
            return d.colour;
        })
        .attr("class", "links")
        .attr("stroke-width", lineWidth)
        .style("stroke-opacity", function(d){
            if(d.nodeType == 3){
                return 0.5;
            }
            return 0.5;
        })
        .merge(link);

        // icons
        d3.selectAll(".icons").remove();
        icon = svg.append("g")
        .selectAll("icons")
        .data(graph.nodes).enter()
        .append("use")
        .attr("class", "icons")
        //.attr("filter", "url(#specular)")
        .attr("xlink:href", "#warningIcon")
        .attr("width", currentRadius*2)
        .attr("height", currentRadius*2)
        .style("opacity", function(d,i){

            // only comp nodes
            if(d.nodeType == 2){
                return 0;
            }

            // get thresholds (all)
            var thresh_metrics = {};
            if(metric_type == "lcms"){
                var thresh_metrics = machine_data.run_data[run_index].summary;
            }
            
            // get thresholds per metric
            var thresh_comp = {};
            for(let t in thresh_metrics){
                if(metab_metric_names[t] == d.metricName){
                    thresh_comp = thresh_metrics[t];
                }
            }

            // show
            if(d.name in thresh_comp){
                return 1
            }
            return 0;
        
        });

        // Update and restart the simulation.
        simulation.nodes(graph.nodes);
        simulation.force("link").links(graph.links);
        simulation.alpha(0.1).alphaDecay(0.05).restart();
      }
    
}

function getGraph(w, h){
    
    // centre node 
    /*
    var nodes = [{"id": "LC-MS METRICS", 
                  "name": "LC-MS METRICS", 
                  "nodeType": 1,
                  "radius": 3*currentRadius,
                  "fx": w/2, 
                  "fy": h/2,
                   "colour": "var(--dark)"}];
    */
    var nodes =[];
    var links = [];
    
    var node_positions = {"Mass Error (mDa)": [0.1*w, 0.25*h],
                        "Mass Error (ppm)": [0.5*w, 0.3*h],
                        "Tailing": [0.9*w, 0.25*h],
                        "Full Width Half Maximum": [0.7*w, h/2],
                        "Area (normalised)": [0.3*w, h/2],
                        "Retention Time": [0.5*w, 0.7*h],
                        "Asymmetry": [0.9*w, 0.75*h],
                        "Height (normalised)": [0.1*w, 0.75*h]};

    var units = {"Mass Error (mDa)": "mDa",
    "Mass Error (ppm)": "ppm",
    "Tailing": "Sec.",
    "Full Width Half Maximum": "Sec.",
    "Area (normalised)": "",
    "Retention Time": "Min.",
    "Asymmetry": "Sec.",
    "Height (normalised)": ""};

    // metric nodes and links
    for(let j in machine_data.lcms_metrics){
        var new_node = {"id": machine_data.lcms_metrics[j].display_name,
                        "name": machine_data.lcms_metrics[j].display_name,
                        "metricName": machine_data.lcms_metrics[j].display_name,
                        "radius": 4*currentRadius,  
                        "nodeType": 2,
                        "fx": node_positions[machine_data.lcms_metrics[j].display_name][0], 
                        "fy": node_positions[machine_data.lcms_metrics[j].display_name][1],
                        "x": node_positions[machine_data.lcms_metrics[j].display_name][0], 
                        "y": node_positions[machine_data.lcms_metrics[j].display_name][1],
                        "unit": units[machine_data.lcms_metrics[j].display_name],
                        "colour": "var(--dark)"};
        /*              
        var new_link = {"source": "LC-MS METRICS",
                        "target": machine_data.lcms_metrics[j].display_name,
                        "linkType": 1,
                        "colour": "var(--dark)"};
        */
                        
        nodes.push(new_node);
        //links.push(new_link);
    }

    // TAILING ASYMMETRY (abs. from 1)
    // RT and FWHM (abs. from medium)
    // REST (abs. from zero)
    // component nodes and links
    var component_indexes = getComponentIndexes();
    for(let i in machine_data.components){
        if(component_indexes.includes(i)){
            // link and node for each metric
            for(let j in machine_data.lcms_metrics){
                var new_id = machine_data.components[i]["component_name"]+machine_data.lcms_metrics[j]["metric_id"];

                // compute edge values (as above)
                var actual_value = machine_data.components[i]["lcms_metrics"][machine_data.lcms_metrics[j]["display_name"]]["values"][run_index];
                if(machine_data.lcms_metrics[j].display_name == "Tailing"){
                    var new_value = 1 - actual_value;
                }
                else if(machine_data.lcms_metrics[j].display_name == "Asymmetry"){
                    var new_value = 1 - actual_value;
                }
                else if(machine_data.lcms_metrics[j].display_name == "Retention Time"){
                    var median = machine_data.components[i]["stats"][machine_data.lcms_metrics[j].display_name]["50_percent"];
                    var new_value = median - actual_value;
                }
                else if(machine_data.lcms_metrics[j].display_name == "Full Width Half Maximum"){
                    var median = machine_data.components[i]["stats"][machine_data.lcms_metrics[j].display_name]["50_percent"];
                    var new_value = median - actual_value;
                }
                else{
                    var new_value = actual_value;
                }

                var new_node = {"id": new_id, 
                                "nodeType": 3, 
                                "radius": currentRadius,
                                "name":machine_data.components[i]["component_name"],
                                "metricName": machine_data.lcms_metrics[j].display_name,
                                "colour": machine_data.components[i]["colour"],
                                "x": node_positions[machine_data.lcms_metrics[j].display_name][0], 
                                "y": node_positions[machine_data.lcms_metrics[j].display_name][1],
                                "actualValue": actual_value,
                                "value": Math.abs(new_value),
                                "cIndex": i};

                var new_link = {"source": machine_data.lcms_metrics[j].display_name, 
                                "target": new_id,
                                "targetName": machine_data.components[i]["component_name"],  
                                "value": Math.abs(new_value),
                                "linkType": 2,
                                "linkScale": machine_data.lcms_metrics[j]["metric_id"],
                                "colour": machine_data.components[i]["colour"]};
                               

                nodes.push(new_node);
                links.push(new_link);
            }
        }
    }
    return {"nodes": nodes, "links": links};
}

function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  
  function updateRadiosLineChart(displayName){
    
    // set radios for line chart (enable all) and check radio
    var radios = document.getElementsByName("radioOptions");
    for(let i = 0; i<radios.length; i++){
        var radio_name = radios[i].labels[0].innerText;
        radios[i].disabled = false;
        if(radio_name == displayName){
            radios[i].checked = true;
        }
    }

    // chart buttons
    if(display_metric == "Area (normalised)" || display_metric == "Height (normalised)"){
        document.getElementById("box").disabled = true;
        document.getElementById("box").style.boxShadow = "";
        document.getElementById("box").classList = "btn";
    }
    else{
        document.getElementById("box").disabled = false;
        document.getElementById("box").style.boxShadow = "gray 0.2em 0.2em 0.4em";
        document.getElementById("box").classList = "btn btn-custom";
    }

    if(display_metric == "Retention Time" || display_metric == "Full Width Half Maximum"){
        document.getElementById("heat").disabled = true;
        document.getElementById("heat").style.boxShadow = "";
        document.getElementById("heat").classList = "btn";
    
    }
    else{
        document.getElementById("heat").disabled = false;
        document.getElementById("heat").style.boxShadow = "gray 0.2em 0.2em 0.4em";
        document.getElementById("heat").classList = "btn btn-custom";
        document.getElementById("density").disabled = false;
        document.getElementById("density").style.boxShadow = "gray 0.2em 0.2em 0.4em";
        document.getElementById("density").classList = "btn btn-custom";
        document.getElementById("stream").disabled = false;
        document.getElementById("stream").style.boxShadow = "gray 0.2em 0.2em 0.4em";
        document.getElementById("stream").classList = "btn btn-custom";
        document.getElementById("line").disabled = false;
        document.getElementById("line").style.boxShadow = "gray 0.2em 0.2em 0.4em";
        document.getElementById("line").classList = "btn btn-custom";
    }

    // change background and update state (select line)
    var buttons = document.getElementsByName("chart-buttons");
    for(let i =0; i<buttons.length; i++){
        buttons[i].style.backgroundColor = "var(--dark)";
        buttons[i].style.color = "white";
        buttons[i].style.borderColor = "var(--info)";

        if(buttons[i].id == "line"){
            buttons[i].style.backgroundColor = "white";
            buttons[i].style.borderColor = "var(--dark)";
            buttons[i].style.color = "var(--dark)";
        }
    }

  }

  function draw_force_graph(transition){

    // NOT USED
    // get width and height of plot area
    var plot_area = document.getElementById("plot_chart");
    var chart_bottom = document.getElementById("chart_bottom");
    var chart_top = document.getElementById("chart_top");
    var plot_height = plot_area.offsetHeight;
    var plot_width = plot_area.offsetWidth;

    // set the dimensions and margins of the graph
    var margin = {top: chart_top.offsetHeight, right: 4*v_width_unit, 
        bottom: chart_bottom.offsetHeight, left: 0};
    var width = plot_width - margin.left - margin.right;
    var height = plot_height - margin.top - margin.bottom;

    // remove any elements in plot area
    while (plot_area.firstChild) {
        plot_area.removeChild(plot_area.firstChild);
    }
    plot_area.style.opacity = 1;

    // append the svg object to the plot area
    var svg = d3.select("#plot_chart")
    .append("svg")
        .attr("width", plot_width)
        .attr("height", plot_height)
    .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    var gradFill = svg
    .append('defs')
    .append('linearGradient')
    .attr('id', 'middleCircleFill')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%')

    gradFill.append('stop')
    .attr('offset', '0%')
    .style('stop-color', "whitesmoke")
    .style('stop-opacity', 1);

    gradFill.append('stop')
    .attr('offset', '50%')
    .style('stop-color', 'var(--dark)')
    .style('stop-opacity', 1);

    gradFill.append('stop')
    .attr('offset', '100%')
    .style('stop-color', 'var(--dark)')
    .style('stop-opacity', 1);

    // ylabel right (display metric)
    svg.append("text")
    .attr("transform", "rotate(90)")
    .attr("class", "label-metric lineText")
    .attr("y", -width- margin.right/2)
    .attr("x",(height / 2))
    .attr("dy", "1em")
    .style("cursor", "help")
    .style("text-anchor", "middle")
    .attr("fill", function(){
            if(theme == "dark"){return "white";}
            return "var(--dark)";
        })
    .attr("stroke", function(){
        if(theme == "dark"){return "white";}
        return "var(--dark)";
    })
    .on("mouseover", function(event){
        // set header tooltip
        var toolInfo;
        for(let i in machine_data.lcms_metrics){
                if(machine_data.lcms_metrics[i].display_name == display_metric){
                    toolInfo = machine_data.lcms_metrics[i].metric_info;
                    break;
                }
        }
        var tooltip = d3.select("#tooltip");
        tooltip.html(toolInfo);
        tooltip.style('left', (event.pageX - 55*v_height_unit) + 'px');
        tooltip.style('top', (event.pageY - 25*v_height_unit) + 'px');
        tooltip.style("visibility", "visible");

    })
    .on("mouseout", function(event){
        var tooltip = d3.select("#tooltip");
        tooltip.style("visibility", "hidden");
    })
    .text(display_metric.toUpperCase());

    var graph = getGraphMetrics(width, height);
    console.log(graph);

    // scale based on each metric
    var edgeScale = d3.scaleLinear()
                    .range([0, 0.3*height])
                    .clamp(true);

    if(display_metric == "Mass Error (ppm)"){
        edgeScale.domain([0, 4]);
    }
    else if(display_metric == "Mass Error (mDa)"){
        edgeScale.domain([0, 3]);
    }
    else if(display_metric == "Tailing"){
        edgeScale.domain([0, 3]);
    }
    else if(display_metric == "Asymmetry"){
        edgeScale.domain([0, 3]);
    }
    else if(display_metric == "Retention Time"){
        edgeScale.domain([0, 25]); // get from processing ?? (for ridge too)
    }
    else if(display_metric == "Full Width Half Maximum"){
        edgeScale.domain([0, 100]);
    }
    else if(display_metric == "Area (normalised)"){
        edgeScale.domain([0, 4]);
    }
    else if(display_metric == "Height (normalised)"){
        edgeScale.domain([0, 4]);
    }
     
    // simulation
    simulation = d3.forceSimulation().alpha(0.3).alphaDecay(0.1).velocityDecay(0.4)
    .force("link", d3.forceLink().id(function(d) { return d.id; }))
    //.force("charge", d3.forceManyBody().strength(2))
    //.force("center", d3.forceCenter(width / 2, height / 2))
    .force("boundary", forceBoundary(0, 0, width, height).strength(0.005))
    .force("collide", d3.forceCollide().radius(function(d){
        if(d.nodeType == 2){
            return 0; //d.radius + lineWidth;
        }
        return d.radius;
    }));

    
    // add links
    var link = svg.append("g")
    .selectAll("line")
    .data(graph.links)
    .enter().append("line")
    .attr("class", "links")
      .attr("stroke-width", lineWidth)
      .style("stroke-opacity", 0.3)
      .attr("fill", "none")
      .attr("stroke", function(d){
        return d.colour;
      });

      // add nodes
    var node = svg.append("g")
    .selectAll("circle")
    .data(graph.nodes)
    .enter().append("circle")
    .attr("class", "nodes")
    .attr("r", function(d){
        if(d.nodeType == 2){
            return edgeScale(1);
        }
        return d.radius;
    })
    //.attr("filter", function(d){
        //if(d.nodeType == 1 && d.rIndex == run_index){return "url(#specular)";}
        //return "url(#specular)";
    //})
    .attr("fill", function(d){
        if(d.nodeType == 2){
            //if(theme == "dark"){return "var(--dark)"}
            //return "white" ;
        return "url(#middleCircleFill)";
        }
        return "url(#circleGradLight" + d.cIndex + ")";
    })
    .attr("stroke", function(d){
        if(d.nodeType ==2){
            if(theme == "dark"){return "white"}
            return "var(--dark)" ;//d.colour;
            //return "url(#middleCircleFill)";
        }
        return d.colour;
        
    })
    .attr("stroke-width", lineWidth/2)
    .style("stroke-opacity", function(d){
        return 0.5;
    })
    .style("fill-opacity", function(d){
        if(d.nodeType == 2){return 0;}
        return 1;
    })
    .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));

    // add text
    var text = svg.append("g")
    .selectAll("headers")
    .data(graph.nodes)
    .enter().append("text")
    .attr("class", "names label-force")
    .text(function(d){
        if(d.nodeType == 2){
            return d.name;
        }
        return "";
    })
    .attr("fill", function(){
        if(theme == "dark"){return "white";}
        return "var(--dark)";
    })
    .attr("stroke", function(){
        if(theme == "dark"){return "white";}
        return "var(--dark)";
    })
    .attr("dy", edgeScale(1))
    .style("text-anchor", "middle");

    // add text
    var text = svg.append("g")
    .selectAll("bullseyes")
    .data(graph.nodes)
    .enter().append("text")
    .attr("class", "names label-force")
    .text(function(d){
        if(d.nodeType == 2){
            return "2ppm";
        }
        return "";
    })
    .attr("fill", function(){
        if(theme == "dark"){return "white";}
        return "var(--dark)";
    })
    .attr("stroke", function(){
        if(theme == "dark"){return "white";}
        return "var(--dark)";
    })
    .attr("dy", -edgeScale(1))
    .attr("font-size", "0.5vh")
    .style("text-anchor", "middle");

    simulation
    .nodes(graph.nodes)
    .on("tick", ticked);

    simulation.force("link")
        .links(graph.links)
        .distance(function(d){
            return edgeScale(d.value);
        });

    // ticked function
    function ticked() {
        link
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });
    
        node
            .attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });

        text
            .attr("x",  d => d.x)
            .attr("y", d => d.y);
      }

  }

  // NOT USED
  function getGraphMetrics(w, h){

    var node_positions = {};
    node_positions["1"] = [[0.5*w, 0.5*h]];
    node_positions["2"] = [[0.25*w, 0.5*h], [0.75*w, 0.5*h]];
    node_positions["3"] = [[0.2*w, 0.5*h], [0.5*w, 0.5*h], [0.8*w, 0.5*h]];
    node_positions["4"] = [[0.25*w, 0.25*h], [0.75*w, 0.25*h], [0.25*w, 0.75*h], [0.75*w, 0.75*h]];
    node_positions["5"] = [[0.2*w, 0.25*h], [0.5*w, 0.25*h], [0.8*w, 0.25*h], 
                                [0.25*w, 0.75*h], [0.75*w, 0.75*h]];
    node_positions["6"] = [[0.2*w, 0.25*h], [0.5*w, 0.25*h], [0.8*w, 0.25*h], 
                            [0.2*w, 0.75*h], [0.5*w, 0.75*h], [0.8*w, 0.75*h]];
    node_positions["7"] = [[0.2*w, 0.25*h], [0.4*w, 0.25*h], [0.6*w, 0.25*h], [0.8*w, 0.25*h],
                            [0.2*w, 0.75*h], [0.5*w, 0.75*h], [0.8*w, 0.75*h]];
    node_positions["8"] = [[0.2*w, 0.25*h], [0.4*w, 0.25*h], [0.6*w, 0.25*h], [0.8*w, 0.25*h],
                            [0.2*w, 0.75*h], [0.4*w, 0.75*h], [0.6*w, 0.75*h], [0.8*w, 0.75*h]];
    

    var nodes =[];
    var links = [];

    // ALL (abs. from zero)
    // component nodes and links
    var component_indexes = getComponentIndexes();
    for(let i in machine_data.components){
        var newX = Math.random()*w;
        var newY = Math.random()*h;
        if(component_indexes.includes(i)){
            // component main node
            var new_main_node = {"id": machine_data.components[i]["component_name"], 
                            "nodeType": 2, 
                            "radius": 4*currentRadius,
                            "name":machine_data.components[i]["component_name"],
                            "colour": machine_data.components[i]["colour"],
                            "cIndex": i,
                            "x": newX,
                            "y": newY}; 
            nodes.push(new_main_node);

            var values = machine_data.components[i]["lcms_metrics"][display_metric].values.slice(0, filter);
            for(let j in values){
                // component nodes and links
                if(j == run_index){
                    var rad = currentRadius;
                    var nodeType = 3;
                }
                else{
                    var rad = radius;
                    var nodeType = 1;
                }
                var new_node = {"id": machine_data.components[i]["component_name"] + j, 
                                "nodeType": nodeType, 
                                "radius": rad,
                                "name":machine_data.components[i]["component_name"],
                                "colour": machine_data.components[i]["colour"],
                                "cIndex": i,
                                "rIndex": j,
                                "x": newX,
                                "y": newY};
                                
                var new_link = {"source": machine_data.components[i]["component_name"], 
                                "target": machine_data.components[i]["component_name"] + j, 
                                "linkType": 1,
                                "linkScale": machine_data.components[i]["component_name"],
                                "colour": machine_data.components[i]["colour"],
                                "value": Math.abs(values[j])};
                 nodes.push(new_node);
                 links.push(new_link);
            }
            
        }
    }
    return {"nodes": nodes, "links": links};
  }