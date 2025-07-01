// convert a string to date (map)
function convert_date(date){
    return new Date(date);
}

// convert from JSON (map)
function convert_JSON(text){
    return JSON.parse(text);
}

// nav dropdown function
function create_navbar_dropdown(){

    // get dropdown
    let nav_dropdown = document.getElementById('navbar-machines');

    // get all machine names from storage for nav bar (needed by create_navbar_Dropdown or will error)
    var proteomics = JSON.parse(sessionStorage.getItem("proteomics-machines"));
    var metabolomics = JSON.parse(sessionStorage.getItem("metabolomics-machines"));

    // add metabolomics
    if(metabolomics.length > 0){
        let new_header = document.createElement("div");
        let new_divider = document.createElement("div");
        new_header.className = "dropdown-header";
        new_header.style.fontWeight = 700;
        new_header.style.color = "var(--dark)";
        new_header.innerHTML = "METABOLOMICS";
        new_divider.className = "dropdown-divider";
        new_header.append(new_divider);
        nav_dropdown.append(new_header);

        for(let i=0; i<metabolomics.length; i++){
            let new_link = document.createElement("a");
            new_link.setAttribute("data-chart-menu", "METABOLOMICS"); // for chart change
            let new_icon = document.createElement("span");
            // link
            new_link.href = "#";
            new_link.className = "dropdown-item";
            for(let machine in metabolomics[i]){
                new_link.innerHTML = machine;
                // icon
                if(metabolomics[i][machine] > 0){
                    new_icon.className = "fas fa-exclamation-triangle text-danger";
                }
                else{
                    new_icon.className = "fas fa-check text-success";
                }
            }
            // append to dropdowm
            new_link.append(new_icon);
            nav_dropdown.append(new_link);
        }
    }

    // add space
    let new_break = document.createElement("br");
    nav_dropdown.append(new_break);

    // add proteomics
    if(proteomics.length > 0){
        let new_header = document.createElement("div");
        let new_divider = document.createElement("div");
        new_header.className = "dropdown-header";
        new_header.style.fontWeight = 700;
        new_header.style.color = "var(--dark)";
        new_header.innerHTML = "PROTEOMICS";
        new_divider.className = "dropdown-divider";
        new_header.append(new_divider);
        nav_dropdown.append(new_header);

        for(let i=0; i<proteomics.length; i++){
            let new_link = document.createElement("a");
            new_link.setAttribute("data-chart-menu", "PROTEOMICS"); // for chart change
            let new_icon = document.createElement("span");
            // link
            new_link.href = "#";
            new_link.className = "dropdown-item";
            for(let machine in proteomics[i]){
                new_link.innerHTML = machine;
                // icon
                if(proteomics[i][machine] > 0){
                    new_icon.className = "fas fa-exclamation-triangle text-danger";
                }
                else{
                    new_icon.className = "fas fa-check text-success";
                }
            }
            // append to dropdowm
            new_link.append(new_icon);
            nav_dropdown.append(new_link);
        }
    }
}

// Tooltips (javascript.info)
document.onmouseover = function(event) {
    let target = event.target;
    
    // if we have tooltip HTML...
    let tooltipHtml = target.dataset.tooltip;
    
    // ...create the tooltip element
    tooltipElem = document.createElement('div');
    tooltipElem.className = 'tooltipCustom trans-o';
    tooltipElem.innerHTML = tooltipHtml;
    tooltipElem.style.opacity = 0;
    document.body.append(tooltipElem);

    if (!tooltipHtml) return;

    // position it above the annotated element (top-center)
    let coords = target.getBoundingClientRect();

    let left = coords.left + (target.offsetWidth - tooltipElem.offsetWidth);
    if (left < 0) left = 0; // don't cross the left window edge
    
    let top;
    if(target.classList.contains("date")){
        top = coords.top - tooltipElem.offsetHeight - 30; // lift date tooltip above window
    }
    else{
        top = coords.top - tooltipElem.offsetHeight - 5;
    }
    
    // if crossing the bottom window edge, show top instead
    if ((top - tooltipElem.offsetHeight)< 0) { 
        top = coords.top - tooltipElem.offsetHeight - 5;
        if(top< 0){ // crossing top, show bottom
            top = coords.top + target.offsetHeight + 5;
        }
    }
    
    // room at right screen
    if((left+tooltipElem.offsetWidth) > (screen.availWidth - 100)){
        left = screen.availWidth - 100 - tooltipElem.offsetWidth;
    };

    tooltipElem.style.left = left + 'px';
    tooltipElem.style.top = top + 'px';
    tooltipElem.style.opacity = 1;
};

document.onmouseout = function(e) {
        if (tooltipElem) {
            tooltipElem.remove();
            tooltipElem = null;
    }  
};

// handle change to chart page  and reload
// NOTE: don't use backslashes as returns to domain not host
document.onclick = function(event){

    var target = event.target;
    var metric = "Mass Error (ppm)";
    var experiment;
    var machine;

    // change home icon to spinner
    var home_icon = document.getElementById("home");

    if(target.hasAttribute("data-chart-menu")){
        machine = target.childNodes[0].data;
        experiment = target.getAttribute("data-chart-menu");
    }
    else if(target.hasAttribute("data-chart-front")){
        machine = target.parentElement.childNodes[0].innerHTML;
        experiment = target.parentElement.childNodes[1].innerHTML;
    }
    else if(target.hasAttribute("data-chart-back")){
        let tile = target.parentElement.parentElement.parentElement.parentElement;
        let tile_front = tile.childNodes[0].childNodes[0];
        machine = tile_front.childNodes[0].innerHTML;
        experiment = tile_front.childNodes[1].innerHTML;
        metric = target.getAttribute("data-chart-back");
    }
    else if(target.hasAttribute("data-reload")){ // reload
        home_icon.className = "fa fa-spinner fa-spin";
        var new_path = ".";
        window.location.assign(new_path);
        return;
    }
    else if(target.hasAttribute("data-config")){ // reconfig
        //home_icon.className = "fa fa-spinner fa-spin";
        var new_path = "reconfig";
        //window.location.assign(new_path);
        window.open(new_path, '_blank');
        return;
    }
    else if(target.hasAttribute("data-user-config")){ // config or process (from userguides)

        if(target.getAttribute("data-user-config") == "true"){
            var page = "configuration";
        }
        else{
            var page = "process";
        }

        window.location.assign(page);
        return;
    }
    else if(target.hasAttribute("data-process")){ // process
        //home_icon.className = "fa fa-spinner fa-spin";

        var query = new URLSearchParams();
        query.append("caller", "main");

        var new_path = "process" + "?" + query.toString();
        //window.location.assign(new_path);
        window.open(new_path, '_blank');
        return;
    }
    else if(target.hasAttribute("data-user")){ // user guide

        var query = new URLSearchParams();
        query.append("caller", target.getAttribute("data-user"));

        var new_path = "userguide"  + "?" + query.toString();
        //window.location.assign(new_path);
        window.open(new_path, '_blank');
        return;
    }
    else{
        return;
    }

    // change to loading icon
    home_icon.className = "fa fa-spinner fa-spin";

    // create query string
    var query = new URLSearchParams();
    query.append("machine", machine);
    query.append("experiment", experiment);
    query.append("metric", metric);

    // redirect to new page with query string
    var new_path = experiment.toLowerCase() + "?" + query.toString();
    window.location.assign(new_path);

};

function diff_days(date1){

    // diff in days between today and date (now not working)
    var today = new Date();
    date1 = new Date(date1);

    var diff = today.getTime() - date1.getTime();
    return Math.floor(diff/(1000 * 60 * 60 * 24)); 
}

function get_time(date){
    // remove seconds (using strings)
    let full_time = date.toLocaleTimeString();
    //let end = full_time.substr(full_time.length-2);
    let start = full_time.substr(0, 5);
    if(start.charAt(start.length - 1) === ":"){
        start =start.substr(0, start.length-1);
    }

    // am/pm
    if(parseInt(start.substr(0, 2)) > 11){
       var meridian = "pm";
    }
    else{
        var meridian = "am";
    }

    let display_time = start + " " + meridian;
    return display_time;
}

/* STATS FUNCTIONS  */
// https://snippets.bentasker.co.uk/page-1907020841-Calculating-Mean,-Median,-Mode,-Range-and-Percentiles-with-Javascript-Javascript.html

 function calcAverage(arr){
    var a = arr.slice();
    if (a.length){
        sum = sumArr(a);
        avg = sum / a.length;
        return avg;
    }    
    return false;
}

function calcMedian(arr){
    var a = arr.slice();
    hf = Math.floor(a.length/2);
    arr = sortArr(a);
    if (a.length % 2){
        return a[hf];
    }else{
        return (parseFloat(a[hf-1]) + parseFloat(a[hf])) / 2.0;
    }
}

function calcQuartile(arr,q){
    var a = arr.slice();
    // Turn q into a decimal (e.g. 95 becomes 0.95)
    q = q/100;

    // Sort the array into ascending order
    data = sortArr(a);

    // Work out the position in the array of the percentile point
    var p = ((data.length) - 1) * q;
    var b = Math.floor(p);

    // Work out what we rounded off (if anything)
    var remainder = p - b;

    // See whether that data exists directly
    if (data[b+1]!==undefined){
        return parseFloat(data[b]) + remainder * (parseFloat(data[b+1]) - parseFloat(data[b]));
    }else{
        return parseFloat(data[b]);
    }
}

function sumArr(arr){
    var a = arr.slice();
    return a.reduce(function(a, b) { return parseFloat(a) + parseFloat(b); });
}

function sortArr(arr){
    var ary = arr.slice();
    ary.sort(function(a,b){ return parseFloat(a) - parseFloat(b);});
    return ary;
}

/* Drag Functions 
https://www.w3schools.com/howto/howto_js_draggable.asp
*/

function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (document.getElementById(elmnt.id + "header")) {
      // if present, the header is where you move the DIV from:
      document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
    } else {
      // otherwise, move the DIV from anywhere inside the DIV:
      elmnt.onmousedown = dragMouseDown;
    }
  
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;

      // change opacity
      //elmnt.style.opacity = 0.8;
    }
  
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // set the element's new position:
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }
  
    function closeDragElement() {
      // stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;

      // change opacity
      //elmnt.style.opacity = 1;
    }
  }


  // create element styles (override bootstrap)
  function ButtonOnChart(html, name, callBack){
    var new_button = document.createElement("button");
    new_button.className = "btn btn-custom";
    new_button.setAttribute("name", name);
    new_button.addEventListener("click", callBack);
    new_button.setAttribute("type", "button");
    new_button.innerHTML = html;
    new_button.style.borderBottom = "0.4em solid var(--dark)";
    new_button.style.borderRight = "0.4em solid var(--dark)";
    //new_button.style.border = "0.4em solid var(--dark)";
    new_button.style.borderRadius = "1em";
    new_button.style.color = "var(--dark)";
    new_button.style.backgroundColor = "white";
    new_button.style.fontSize = "0.8vw";
    new_button.style.letterSpacing = "0.2vh";
    new_button.style.marginRight = "2vh";
    new_button.style.boxShadow = "0.2em 0.2em 0.4em gray";
    return new_button;
  }

  function ButtonOffChart(html, name, callBack){
    var new_button = document.createElement("button");
    new_button.className = "btn btn-custom";
    new_button.setAttribute("name", name);
    new_button.addEventListener("click", callBack);
    new_button.setAttribute("type", "button");
    new_button.innerHTML = html;
    new_button.style.borderBottom = "0.4em solid var(--info)";
    new_button.style.borderRight = "0.4em solid var(--info)";
    //new_button.style.border = "0.4em solid var(--info)";
    new_button.style.borderRadius = "1em";
    new_button.style.color = "white";
    new_button.style.backgroundColor = "var(--dark)";
    new_button.style.fontSize = "0.8vw";
    new_button.style.letterSpacing = "0.2vh";
    new_button.style.marginRight = "2vh";
    new_button.style.boxShadow = "0.2em 0.2em 0.4em gray";
    return new_button;
  }

  // update theme
  // mix of d3, css and shear will!
 
  function changeThemeDark(el){

    var t = d3.transition().duration(1500);
    
    // check and update state
    if(theme == "dark"){return;}
    theme = "dark";

    // change menu circle backgrounds (if unchecked)
    d3.selectAll(".menuCircle")
    .style("fill", function(d,i){
        if(checked_components[d.component_name]){
            return d.colour;//"url(#circleGradLight"+d.c_index+")"
        }
        else{
            return "var(--dark)";
        }
    })

    // change chart themes
    d3.selectAll(".Theme")
    .style("background-color", "var(--dark)")
    .style("border-color", "var(--dark)")
    .style("color", "white");

    // change comp labels
    d3.selectAll(".comp_label")
    .style("stroke", "white")
    .style("fill", "white");

    // change headers
    d3.select("#cgram_metric_header")
    .style("color", "white");

    d3.select("#profile_pump_header")
    .style("color", "white");

    // chart backgrounds
    d3.select("#backChrom")
        .style("fill", "var(--dark)");

    d3.select("#backLine")
    .style("fill", "var(--dark)");

    d3.select("#backPressure")
    .style("fill", "var(--dark)");

    d3.select("#backPressureBack")
    .style("fill", "var(--dark)");

    d3.select("#backBox")
    .style("fill", "var(--dark)");

    // chart text and labels
    d3.selectAll("text.label").transition(t)
        .style("fill", "white")
        .style("stroke", "white");

     // chart text and labels
     d3.selectAll("text.label-metric").transition(t)
     .style("fill", "white")
     .style("stroke", "white");

     // force labels
     //d3.selectAll(".background_rect").transition(t)
     //.style("stroke", "white");

     // chart text and labels
     d3.selectAll("text.statText").transition(t)
     .style("fill", "white")
     .style("stroke", "white");

     // chart text and labels
     d3.selectAll("line.statsMarker").transition(t)
     .style("stroke", "white");

    // axes
    d3.selectAll(".Axis").transition(t)
        .style("color", "white");

    // gridlines (NOT WORKING)
    d3.selectAll(".gridlines")
        .style("stroke", "var(--dark)");

    // vertical marker
    d3.select("#marker").transition(t)
    .style("stroke", "white");

    // heat marker
    d3.select("#heatMarker").transition(t)
    .style("stroke", "white");

    // right chart "axis"
    d3.select("#rightAxis").transition(t)
    .style("stroke", "white");

    // threshold
    d3.select(".topoverlay").transition(t)
    .style("fill", 'var(--dark)');

    d3.select(".bottomoverlay").transition(t)
    .style("fill", 'var(--dark)');

    d3.select(".ms2overlay").transition(t)
    .style("fill", 'var(--dark)');

    // ridges
    d3.selectAll(".ridge").attr("stroke", function(){
        return "white";
    })

    // chromatogram
    d3.selectAll(".chromArea").attr("stroke", function(){
        return "white";
    })

    // pressure profile
    d3.selectAll(".pressureArea").attr("stroke", function(){
        return "white";
    })

    // chart epand/contract
    d3.select("#chartIcon").transition(t)
    .style("fill", "white");

    // box optimal marker
    d3.select("#optimal_marker").transition(t)
    .style("stroke", "aliceblue")
    
  }

  function changeThemeLight(el){

    var t = d3.transition().duration(1500);

    // check and update state
    if(theme == "light"){return;}
    theme = "light";

    // change menu circle backgrounds (if unchecked)
    d3.selectAll(".menuCircle")
    .style("fill", function(d,i){
        if(checked_components[d.component_name]){
            return d.colour; //"url(#circleGradLight"+d.c_index+")"
        }
        else{
            return "var(--dark)";
        }
    })
    
    // change chart themes
    d3.selectAll(".Theme")
    .style("background-color", "white")
    .style("border-color", "white")
    .style("color", "var(--dark)");

    // change comp labels
    d3.selectAll(".comp_label")
    .style("stroke", "var(--dark)")
    .style("fill", "var(--dark)");

    // change headers
    d3.select("#cgram_metric_header")
    .style("color", "var(--dark)");

    d3.select("#profile_pump_header")
    .style("color", "var(--dark)");

    // chart backgrounds
    d3.select("#backChrom")
        .style("fill", "white");

    d3.select("#backLine")
    .style("fill", "white");

    d3.select("#backPressure")
    .style("fill", "white");

    d3.select("#backPressureBack")
    .style("fill", "white");

    d3.select("#backBox")
    .style("fill", "white");

    // chart text and labels
    d3.selectAll("text.label").transition(t)
        .style("fill", "var(--dark)")
        .style("stroke", "var(--dark)");

     // chart text and labels
     d3.selectAll("text.label-metric").transition(t)
     .style("fill", "var(--dark)")
     .style("stroke", "var(--dark)");

     // force labels
     //d3.selectAll(".background_rect").transition(t)
     //.style("stroke", "var(--dark)");


      // chart text and labels
      d3.selectAll("text.statText").transition(t)
      .style("fill", "var(--dark)")
      .style("stroke", "var(--dark)");

      // chart text and labels
      d3.selectAll("line.statsMarker").transition(t)
      .style("stroke", "var(--dark)");

    // axes
    d3.selectAll(".Axis").transition(t)
        .style("color", "var(--dark)");

    //gridlines (NOT WORKING)
    d3.selectAll(".gridlines")
        .style("stroke", "#def");

    // vertical marker
    d3.select("#marker").transition(t)
    .style("stroke", "var(--dark)");

    // heat marker
    d3.select("#heatMarker").transition(t)
    .style("stroke", "var(--dark)");

     // right chart "axis"
     d3.select("#rightAxis").transition(t)
     .style("stroke", "var(--dark)");

    // thresholds
    d3.select(".topoverlay").transition(t)
    .style("fill", 'var(--dark)');

    d3.select(".bottomoverlay").transition(t)
    .style("fill", 'var(--dark)');

    d3.select(".ms2overlay").transition(t)
    .style("fill", 'var(--dark)');

    // ridges
    d3.selectAll(".ridge").attr("stroke", function(){
        return "var(--dark)";
    })

    // chromatogram
    d3.selectAll(".chromArea").attr("stroke", function(){
        return "var(--dark)";
    })

    // pressure profile
    d3.selectAll(".pressureArea").attr("stroke", function(){
        return "var(--dark)";
    })

    // chart epand/contract
    d3.select("#chartIcon").transition(t)
    .style("fill", "var(--dark)")

    // box optimal marker
    d3.select("#optimal_marker").transition(t)
    .style("stroke", "var(--dark)")
    
  }

// https://stackoverflow.com/questions/11503151/in-d3-how-to-get-the-interpolated-line-data-from-a-svg-line/39442651#39442651
// https://talk.observablehq.com/t/obtain-interpolated-y-values-without-drawing-a-line/1796

var findYatXbyBisection = function(x, path, error){
    var length_end = path.getTotalLength()
      , length_start = 0
      , point = path.getPointAtLength((length_end + length_start) / 2) // get the middle point
      , bisection_iterations_max = 50
      , bisection_iterations = 0
  
    error = error || 0.01
  
    while (x < point.x - error || x > point.x + error) {
      // get the middle point
      point = path.getPointAtLength((length_end + length_start) / 2)
  
      if (x < point.x) {
        length_end = (length_start + length_end)/2
      } else {
        length_start = (length_start + length_end)/2
      }
  
      // Increase iteration
      if(bisection_iterations_max < ++ bisection_iterations)
        break;
    }
    return point;
  }

  // show/hide menu
  function showMenu(event){
    var menu = d3.select("#menu");

    // change tooltip
    if(menu_show){
        menu_show = false;
        document.getElementById("metric_menu").setAttribute("data-tooltip", "Click for Metric Menu");
    }
    else{
        menu_show = true;
        document.getElementById("metric_menu").setAttribute("data-tooltip", "Click to hide Metric Menu");
    }
    
    // close if open
    if(menuModal){
        menu.style("visibility", "hidden");
        menuModal = false;
        return;
    }

    // display menu
    menuModal = true;
    menu.style('left', (event.pageX) + 'px');
    menu.style('top', (event.pageY) + 'px');
    menu.style("visibility", "visible");
    
  }

/* OLD density functions */
  // function to compute density
  function kernelDensityEstimator(kernel, X) {
    return function(V) {
        return X.map(function(x) {
        return [x, d3.mean(V, function(v) { return kernel(x - v); })];
        });
    };
}

// actual estimator funcion (Epanechnikov most accurate)
function kernelEpanechnikov(k) {
return function(v) {
    return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
};
}

// parameter for kernel
function silvermans(a){
a.sort((a, b) => a - b);
var n = a.length;
var q1_index = Math.ceil((n+1)/4) - 1;
var q3_index = Math.ceil(3*(n+1)/4) - 1;
var Q1 = a[q1_index];
var Q3 = a[q3_index];
var IQR = Q3 - Q1;
var sd = getSD(a);
var min_value = Math.min(IQR/1.35,sd);
var h = 0.9*Math.pow(min_value, -1/5);
return h;
}

function getSD(array) {
// https://stackoverflow.com/questions/7343890/standard-deviation-javascript
const n = array.length;
const mean = array.reduce((a, b) => a + b) / n;
return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
}

function createExpandSVG(svg){
    // SVG warning symbol definition
    var symbolSVG = svg
    .append("symbol")
    .attr("id", "expandIcon")
    .attr("viewBox", "0 0 1024 1024");

    symbolSVG.append("path")
    .style("fill", "black")
    .attr("d", "M290 236.4l43.9-43.9a8.01 8.01 0 0 0-4.7-13.6L169 160c-5.1-.6-9.5 3.7-8.9 8.9L179" +
    " 329.1c.8 6.6 8.9 9.4 13.6 4.7l43.7-43.7L370 423.7c3.1 3.1 8.2 3.1 11.3 0l42.4-42.3c3.1-3.1" +
    " 3.1-8.2 0-11.3L290 236.4zm352.7 187.3c3.1 3.1 8.2 3.1 11.3 0l133.7-133.6 43.7 43.7a8.01 8.01" +
    " 0 0 0 13.6-4.7L863.9 169c.6-5.1-3.7-9.5-8.9-8.9L694.8 179c-6.6.8-9.4 8.9-4.7 13.6l43.9 43.9L600.3" +
    " 370a8.03 8.03 0 0 0 0 11.3l42.4 42.4zM845 694.9c-.8-6.6-8.9-9.4-13.6-4.7l-43.7 43.7L654 600.3a8.03" +
    " 8.03 0 0 0-11.3 0l-42.4 42.3a8.03 8.03 0 0 0 0 11.3L734 787.6l-43.9 43.9a8.01 8.01 0 0 0 4.7 13.6L855" +
    " 864c5.1.6 9.5-3.7 8.9-8.9L845 694.9zm-463.7-94.6a8.03 8.03 0 0 0-11.3 0L236.3 733.9l-43.7-43.7a8.01" +
    " 8.01 0 0 0-13.6 4.7L160.1 855c-.6 5.1 3.7 9.5 8.9 8.9L329.2 845c6.6-.8 9.4-8.9 4.7-13.6L290" +
    " 787.6 423.7 654c3.1-3.1 3.1-8.2 0-11.3l-42.4-42.4z");

}

function createContractSVG(svg){
    // SVG warning symbol definition
    var symbolSVG = svg
    .append("symbol")
    .attr("id", "contractIcon")
    .attr("viewBox", "0 0 1024 1024");

    symbolSVG.append("path")
    .style("fill", "black")
    .attr("d", "M391 240.9c-.8-6.6-8.9-9.4-13.6-4.7l-43.7 43.7L200 146.3a8.03 8.03 0 0 0-11.3" +
    " 0l-42.4 42.3a8.03 8.03 0 0 0 0 11.3L280 333.6l-43.9 43.9a8.01 8.01 0 0 0 4.7 13.6L401" +
    " 410c5.1.6 9.5-3.7 8.9-8.9L391 240.9zm10.1 373.2L240.8 633c-6.6.8-9.4 8.9-4.7 13.6l43.9" +
    " 43.9L146.3 824a8.03 8.03 0 0 0 0 11.3l42.4 42.3c3.1 3.1 8.2 3.1 11.3 0L333.7 744l43.7" +
    " 43.7A8.01 8.01 0 0 0 391 783l18.9-160.1c.6-5.1-3.7-9.4-8.8-8.8zm221.8-204.2L783.2" +
    " 391c6.6-.8 9.4-8.9 4.7-13.6L744 333.6 877.7 200c3.1-3.1 3.1-8.2 0-11.3l-42.4-42.3a8.03" +
    " 8.03 0 0 0-11.3 0L690.3 279.9l-43.7-43.7a8.01 8.01 0 0 0-13.6 4.7L614.1 401c-.6 5.2 3.7" +
    " 9.5 8.8 8.9zM744 690.4l43.9-43.9a8.01 8.01 0 0 0-4.7-13.6L623 614c-5.1-.6-9.5 3.7-8.9 8.9L633" +
    " 783.1c.8 6.6 8.9 9.4 13.6 4.7l43.7-43.7L824 877.7c3.1 3.1 8.2 3.1 11.3 0l42.4-42.3c3.1-3.1" +
    " 3.1-8.2 0-11.3L744 690.4z");

}

function createSVGMenu(menuDivID, menuData, name, thresholds){

    var legendSVG = d3.select("#"+menuDivID)
    .append("svg")
        .attr("width", "100%")
        .attr("height", (menuData.length*3*currentRadius) + currentRadius);

    // SVG warning symbol definition
    var symbolSVG = legendSVG
    .append("symbol")
    .attr("id", "warningIcon")
    .attr("viewBox", "0 0 432.464 432.464");
    
    symbolSVG.append("path")
    .style("fill", "var(--danger)")
    .style("fill-opacity", 0.8)
    .attr("d", "M15.166,363.067L199.655,43.523c9.959-17.249,34.856-17.249,44.815,0l184.489,319.544" +
            "c9.959,17.249-2.49,38.811-22.407,38.811H37.574C17.656,401.878,5.207,380.316,15.166,363.067z")
    
    symbolSVG.append("polygon")
    .style("fill", "var(--danger)")
    .style("fill-opacity", 0.8)
    .attr("points", "48.184,369.878 222.062,68.712 395.939,369.878");

    symbolSVG.append("circle")
    .style("fill", "black")
    .style("fill-opacity", 0.8)
    .attr("cx", "222.062")
    .attr("cy", "323.818")
    .attr("r", "24");

    symbolSVG.append("path")
    .style("fill", "black")
    .style("fill-opacity", 0.8)
    .attr("d", "M222.062,148.818L222.062,148.818c-12.982,0-23.251,10.992-22.367,23.944l6.348,93.091" +
        "c0.574,8.424,7.576,14.965,16.02,14.965h0c8.444,0,15.445-6.54,16.02-14.965l6.348-93.091" +
        "C245.312,159.811,235.044,148.818,222.062,148.818z");

    // ** Add expand/contract svgs here for all charts to use **//
    var contractSVG = legendSVG
    .append("symbol")
    .attr("id", "contractIcon")
    .attr("viewBox", "0 0 1024 1024");

    contractSVG.append("path")
    //.style("fill", "var(--dark)")
    .attr("d", "M391 240.9c-.8-6.6-8.9-9.4-13.6-4.7l-43.7 43.7L200 146.3a8.03 8.03 0 0 0-11.3" +
    " 0l-42.4 42.3a8.03 8.03 0 0 0 0 11.3L280 333.6l-43.9 43.9a8.01 8.01 0 0 0 4.7 13.6L401" +
    " 410c5.1.6 9.5-3.7 8.9-8.9L391 240.9zm10.1 373.2L240.8 633c-6.6.8-9.4 8.9-4.7 13.6l43.9" +
    " 43.9L146.3 824a8.03 8.03 0 0 0 0 11.3l42.4 42.3c3.1 3.1 8.2 3.1 11.3 0L333.7 744l43.7" +
    " 43.7A8.01 8.01 0 0 0 391 783l18.9-160.1c.6-5.1-3.7-9.4-8.8-8.8zm221.8-204.2L783.2" +
    " 391c6.6-.8 9.4-8.9 4.7-13.6L744 333.6 877.7 200c3.1-3.1 3.1-8.2 0-11.3l-42.4-42.3a8.03" +
    " 8.03 0 0 0-11.3 0L690.3 279.9l-43.7-43.7a8.01 8.01 0 0 0-13.6 4.7L614.1 401c-.6 5.2 3.7" +
    " 9.5 8.8 8.9zM744 690.4l43.9-43.9a8.01 8.01 0 0 0-4.7-13.6L623 614c-5.1-.6-9.5 3.7-8.9 8.9L633" +
    " 783.1c.8 6.6 8.9 9.4 13.6 4.7l43.7-43.7L824 877.7c3.1 3.1 8.2 3.1 11.3 0l42.4-42.3c3.1-3.1" +
    " 3.1-8.2 0-11.3L744 690.4z");

    var expandSVG = legendSVG
    .append("symbol")
    .attr("id", "expandIcon")
    .attr("viewBox", "0 0 1024 1024");

    expandSVG.append("path")
    //.style("fill", "var(--dark)")
    .attr("d", "M290 236.4l43.9-43.9a8.01 8.01 0 0 0-4.7-13.6L169 160c-5.1-.6-9.5 3.7-8.9 8.9L179" +
    " 329.1c.8 6.6 8.9 9.4 13.6 4.7l43.7-43.7L370 423.7c3.1 3.1 8.2 3.1 11.3 0l42.4-42.3c3.1-3.1" +
    " 3.1-8.2 0-11.3L290 236.4zm352.7 187.3c3.1 3.1 8.2 3.1 11.3 0l133.7-133.6 43.7 43.7a8.01 8.01" +
    " 0 0 0 13.6-4.7L863.9 169c.6-5.1-3.7-9.5-8.9-8.9L694.8 179c-6.6.8-9.4 8.9-4.7 13.6l43.9 43.9L600.3" +
    " 370a8.03 8.03 0 0 0 0 11.3l42.4 42.4zM845 694.9c-.8-6.6-8.9-9.4-13.6-4.7l-43.7 43.7L654 600.3a8.03" +
    " 8.03 0 0 0-11.3 0l-42.4 42.3a8.03 8.03 0 0 0 0 11.3L734 787.6l-43.9 43.9a8.01 8.01 0 0 0 4.7 13.6L855" +
    " 864c5.1.6 9.5-3.7 8.9-8.9L845 694.9zm-463.7-94.6a8.03 8.03 0 0 0-11.3 0L236.3 733.9l-43.7-43.7a8.01" +
    " 8.01 0 0 0-13.6 4.7L160.1 855c-.6 5.1 3.7 9.5 8.9 8.9L329.2 845c6.6-.8 9.4-8.9 4.7-13.6L290" +
    " 787.6 423.7 654c3.1-3.1 3.1-8.2 0-11.3l-42.4-42.4z");

    //** diffuse lighting filter **//
    var lightFilterSVG = legendSVG.
        append("filter")
        .attr("id", "diffuse")
        .attr("primitiveUnits", "objectBoundingBox");

    var feDiffFilterSVG = lightFilterSVG
        .append("feDiffuseLighting")
        .attr("result", "light")
        .attr("in", "SourceGraphic")
        .attr("lighting-color", "white")
        .attr("surfaceScale", "1")
        .attr("diffuseConstant", "1.2");
        

    feDiffFilterSVG
        .append("fePointLight")
        .attr("x", "0.3")
        .attr("y", "0.3")
        .attr("z", "0.5");

    lightFilterSVG
        .append("feComposite")
        .attr("in", "SourceGraphic")
        .attr("in2", "light")
        .attr("operator", "arithmetic")
        .attr("k1", "1")
        .attr("k2", "0")
        .attr("k3", "0")
        .attr("k4", "0");

    //** spec lighting filter **//
    var lightFilterSVG = legendSVG.
        append("filter")
        .attr("id", "specular")
        .attr("primitiveUnits", "objectBoundingBox");

    var feSpecFilterSVG = lightFilterSVG
        .append("feSpecularLighting")
        .attr("result", "specOut")
        .attr("in", "SourceGraphic")
        .attr("lighting-color", "white")
        .attr("surfaceScale", "1")
        .attr("specularExponent", "30")
        .attr("specularConstant", "0.4");
        

    feSpecFilterSVG
        .append("fePointLight")
        .attr("x", "0.25")
        .attr("y", "0.25")
        .attr("z", "0.3");

    lightFilterSVG
        .append("feComposite")
        .attr("in", "SourceGraphic")
        .attr("in2", "specOut")
        .attr("operator", "arithmetic")
        .attr("k1", "0")
        .attr("k2", "1")
        .attr("k3", "1")
        .attr("k4", "0");

    //** back light dark **//
    // .. stars (removed)
    var lightFilterSVG = legendSVG.
        append("filter")
        .attr("id", "backLightDark")
        .attr("primitiveUnits", "objectBoundingBox");

    //lightFilterSVG
        //.append("feTurbulence")
        //.attr("baseFrequency", "0.2")

    //lightFilterSVG
        //.append("feColorMatrix")
        //.attr("values", "0 0 0 9 -4 0 0 0 9 -4 0 0 0 9 -4 0 0 0 0 1")
        //.attr("result", "stars");

    //.. navy back light
    var feSpecFilterSVG = lightFilterSVG
        .append("feSpecularLighting")
        .attr("result", "specOut")
        .attr("lighting-color", "navy")
        .attr("surfaceScale", "1")
        .attr("specularExponent", "60")
        .attr("specularConstant", "0.4");

    feSpecFilterSVG
        .append("fePointLight")
        .attr("x", "0.25")
        .attr("y", "0.25")
        .attr("z", "0.2");

    lightFilterSVG
        .append("feComposite")
        .attr("in", "SourceGraphic")
        .attr("in2", "specOut")
        .attr("operator", "arithmetic")
        .attr("k1", "0")
        .attr("k2", "1")
        .attr("k3", "1")
        .attr("k4", "0");
    
    //** back light light ! **//
    var lightFilterSVG = legendSVG.
        append("filter")
        .attr("id", "backLightLight")
        .attr("primitiveUnits", "objectBoundingBox");

    var feSpecFilterSVG = lightFilterSVG
        .append("feSpecularLighting")
        .attr("result", "specOut")
        .attr("lighting-color", "lightskyblue")
        .attr("surfaceScale", "1")
        .attr("specularExponent", "60")
        .attr("specularConstant", "0.4");

    feSpecFilterSVG
        .append("fePointLight")
        .attr("x", "0.2")
        .attr("y", "0.2")
        .attr("z", "0.4");

    lightFilterSVG
        .append("feComposite")
        .attr("in", "SourceGraphic")
        .attr("in2", "specOut")
        .attr("operator", "arithmetic")
        .attr("k1", "0")
        .attr("k2", "1")
        .attr("k3", "1")
        .attr("k4", "0");
    
    // circle gradient fills
    for(let i in menuData){
        
        var gradFill = legendSVG
        .append('defs')
        .append('linearGradient')
        .attr('id', 'circleGradDark' + menuData[i].c_index)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%')

        gradFill.append('stop')
        .attr('offset', '0%')
        .style('stop-color', menuData[i].colour)
        .style('stop-opacity', 1);

        gradFill.append('stop')
        .attr('offset', '100%')
        .style('stop-color', 'var(--dark)')
        .style('stop-opacity', 1);

        var gradFill = legendSVG
        .append('defs')
        .append('linearGradient')
        .attr('id', 'circleGradLight' + menuData[i].c_index)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%')

        gradFill.append('stop')
        .attr('offset', '0%')
        .style('stop-color', 'whitesmoke')
        .style('stop-opacity', 1);

        gradFill.append('stop')
        .attr('offset', '50%')
        .style('stop-color', menuData[i].colour)
        .style('stop-opacity', 1);

        gradFill.append('stop')
        .attr('offset', '100%')
        .style('stop-color', menuData[i].colour)
        .style('stop-opacity', 1);

        var gradFill = legendSVG
        .append('defs')
        .append('radialGradient')
        .attr('id', 'circleGradLightRad' + menuData[i].c_index)
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%')
        .attr('fx', '50%')
        .attr('fy', '50%');

        gradFill.append('stop')
        .attr('offset', '0%')
        .style('stop-color', 'whitesmoke')
        .style('stop-opacity', 1);

        gradFill.append('stop')
        .attr('offset', '100%')
        .style('stop-color', menuData[i].colour)
        .style('stop-opacity', 1);

    }

    // circles
    legendSVG.selectAll("circleLegend")
        .data(menuData)
        .enter().append("circle")
        .attr("r", currentRadius)
        .attr("class", name + " menuCircle")
        .attr("data-c-index", d => d.c_index)
        .attr("fill", function(d){ 
           return d.colour;//"url(#circleGradLight"+d.c_index+")";
        })
        .attr("stroke", function(d){
            return d.colour; //"url(#circleGradLight"+d.c_index+")";
        })
        .attr("filter", "url(#specular)")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", lineWidth/2)
        .attr("cursor", "pointer")
        .attr("cx", currentRadius + lineWidth)
        .attr("cy", function(d, i){
            return (i*3*currentRadius) + 2*currentRadius;
        })
        .on("click", function(event,d){
            
            // check if last component (prevent zero components)
            checked_components[d.component_name] = !checked_components[d.component_name];
            let comp_count = 0;
            for (const [key, value] of Object.entries(checked_components)) {
                if(value){comp_count+=1;};
            }
            checked_components[d.component_name] = !checked_components[d.component_name]; // reset for backwards combat. with code below
            if(comp_count == 0){
                return;
            }
            
            // change fill and data structures and redraw
            if(checked_components[d.component_name]){
                d3.selectAll(".menuCircle").transition().duration(300)
                .style("fill", function(e, i){
                    if(e.c_index == d.c_index){
                        if(theme == "dark"){return "var(--dark)";}
                        return "var(--dark)";
                    }
                    else{
                        if(checked_components[e.component_name]){
                            return e.color; //"url(#circleGradLight"+e.c_index+")";
                        }
                        else{
                            if(theme == "dark"){return "var(--dark)";}
                            return "var(--dark)";
                        }
                    }
                });
            }
            else{
                d3.selectAll(".menuCircle").transition().duration(300)
                .style("fill", function(e, i){
                    if(e.c_index == d.c_index){
                        return d.colour; //"url(#circleGradLight"+d.c_index+")";
                    }
                    else{
                        if(checked_components[e.component_name]){
                            return e.colour; //"url(#circleGradLight"+e.c_index+")"
                        }
                        else{
                            if(theme == "dark"){return "var(--dark)";}
                            return "var(--dark)";
                        }
                    }
                });
            }

            checked_components[d.component_name] = !checked_components[d.component_name];
            // update stream stack (and draw if stream)
            if(stackKeys.includes(d.component_name)){
                if(chart_type == "stream" && !mainForce && metric_type=="lcms"){update_stream_graph(false);}
                stackKeys = stackKeys.filter(e => e != d.component_name);
            }
            else{
                stackKeys.push(d.component_name);
                if(chart_type == "stream" && !mainForce && metric_type == "lcms"){update_stream_graph(false);}
            }
            
            componentDraw();
            draw_chromatogram(false); // for tooltip
        })

    // labels
    legendSVG.selectAll("displayText")
        .data(menuData)
        .enter().append("text")
        .attr("text-anchor", "start")
        .attr("cursor", "pointer")
        .attr("class", "comp_label")
        .attr("data-c-index", d => d.c_index)
        .attr("fill", function(){
            if(theme == "dark"){return "white";}
            return "var(--dark)";
        })
        .attr("stroke", function(){
            if(theme == "dark"){return "white";}
            return "var(--dark)";
        })
        .attr("x", 3*currentRadius)
        .attr("y", function(d, i){
            return (i*3*currentRadius) + 2*currentRadius;
        })
        .attr("dy", currentRadius/2)
        .style("font-weight", 500)
        .text(d => d.component_name)
        .on("mouseover", function(event){
            var tooltip = d3.select("#tooltip");
            tooltip.html("Hold Ctrl and Click to Select One");
            tooltip.style('left', (event.pageX - 10*v_height_unit) + 'px');
            tooltip.style('top', (event.pageY - 5*v_height_unit) + 'px');
            tooltip.style("visibility", "visible");

        })
        .on("mouseout", function(event){
            var tooltip = d3.select("#tooltip");
            tooltip.style("visibility", "hidden");
        })
        .on("click", function(event, d){

            // select one
            if(event.ctrlKey){
                
                stackKeys = [];
                stackKeys.push(d.component_name);
                if(chart_type == "stream" && !mainForce && metric_type=="lcms"){update_stream_graph(true);}
                d3.selectAll(".menuCircle").transition().duration(300)
                .style("fill", function(e,i){
                    if(e.c_index == d.c_index){
                        checked_components[e.component_name] = true;
                        return d.colour; //"url(#circleGradLight"+d.c_index+")";
                        
                    }
                    else{
                        checked_components[e.component_name] = false;
                        if(theme == "dark"){return "var(--dark)";}
                        return "var(--dark)";
                    }
                })
                componentDraw();
                return;
            }
            // change chromatogram
            comp_index = d.c_index;
            draw_chromatogram(true);
        });

        // warning icons
        legendSVG.selectAll("displayText")
        .data(menuData)
        .enter().append("use")
        .attr("xlink:href", "#warningIcon")
        .attr("x", "85%")
        .attr("y", function(d, i){
            return (i*3*currentRadius + currentRadius);
        })
        .attr("width", currentRadius*2)
        .attr("height", currentRadius*2)
        .attr("filter", "url(#specular)")
        .style("opacity", function(d,i){
            if(d.component_name in thresholds){
                return 1;
            }
            return 0;
        });
        
}