# MaSpeQC
An easy-to-use interactive pipeline to assess the performance of LC-MS/MS instrumentation.  
Suitable for proteomics, metabolomics and lipidomics workflows.  
  
  
<img src="img/fullPage.PNG" alt="qc" height="80%" width="80%"/>  
<img src="img/homePage.PNG" alt="qc" height="80%" width="80%"/>  

Use the menu ![menu](img/menu-hint.PNG) at the top of this README for quick navigation.

## Installation on Windows
To install MaSpeQC on any _Windows_ system, download and unzip the latest release from the link below into the C: drive, then simply run the script ___start_maspeqc_setup.bat___ as administrator from the command line. This will install all of the necessary software and dependencies to use MaSpeQC. 

<a href="https://github.com/MonashProteomics/MaSpecQC/archive/refs/tags/v1.0.1.zip">MaSpeQC Download</a>

## Installation on Linux or MacOS
To install MaSpeQC on any _Linux_ or _MacOS_ system, download and unzip the latest release from the link below. 

<a href="https://github.com/MonashProteomics/MaSpecQC/archive/refs/tags/v1.0.1.tar.gz">MaSpeQC Download</a>

Then add the following software into the _Software_ directory in the main directory. 

- __Proteowizard:__ to convert vendor raw files.
- __MZmine 2.53:__ to extract and process chromatogram peaks.
- __Morpheus (mzML):__ to search MS/MS spectrum.
- __MySQL 5.7.41:__ for storage of processed data.
- __Node.js 18.16:__ to manage the web interface.
- __Python:__

Next, navigate to the _mpmf-pipeline_ directory and create the Python environemnt from the _requirements.txt_ file.
Finally, set-up the node.js server by runnining `npm install` from the _mpmf-server_ directory. 

You can now configure MaSpeQC by running `npm start --setup` and opening a browser window at _http://localhost/configuration_.

## Configuration
During installation, you will be prompted to fill in a configuration form before using MaSpeQC. The following inputs are required to configure the system:

- #### INSTRUMENTS : The LC-MS/MS instruments the system will monitor.
	- _Instrument Name_ (Unique, No Spaces)
	- _Instrument Type_ (Thermo Scientific, Agilient, Bruker, Sciex, Waters)

	__NOTE:__ To use MaSpeQC on _mzML_ files directly, choose _Instrument Type_ as _Other_.
- #### INPUT COMPONENTS : The QC input sample information.
	- _Component Name_ (Unique, No Spaces)
	- _Expected mz value_
	- _Expected Retention Time_ (Minutes)
	- _Polarity_ (Positive/Negative, Metabolomics/Lipidomics Only)

	__NOTE__: A maximum of 15 input components is allowed per QC sample (for metabolomics, this is 15 of each polarity)

- #### THRESHOLDS: The settings to use for warning thresholds.


- #### CONTACTS: The details of the contacts to inform when QC performance thresholds are not met.
	- _Contact Name_
	- _Contatct Email_
- #### INPUT FOLDER: The location of the directories that store the raw files for processing.
- #### OUTPUT FOLDER: Storage for the outputs of the processing.
- #### EMAIL INFO: The details of the email account to use.
	- _Port_ (eg. 465)
	- _SMTP Server_ (eg. smtp.gmail.com)
	- _Email Sender_ 
	- _Email Password_

__NOTE__: To trigger the configuration form manually, navigate to the server directory and type `npm start --setup`

## Starting the Database
To start the database for MaSpeQC, navigate to _/Software/mysql-5.7.41-winx64/bin_ and type:
- `mysqld`

Leave this window open when using MaSpeQC. 

__NOTE__: The database can be activated by setting it to run as a service making it available without manual activation. 

## Processing Raw Files
Make sure the database has been activated, then navigate to  _/mpmf-pipeline/.venv/Scripts_ and type:
- `activate.bat`

This will activate the Python environment needed to process raw files. QC runs can now be triggered from the _/mpmf-pipeline_ directory with the command `python MPMF_Process_Raw_Files.py` and the following __3 arguments__:  
- metabolomics/proteomics
- The number of most recent runs to process (-1 equals process all).
- Y/N for whether to send notification emails or not.
- eg. `python MPMF_Process_Raw_Files.py 'metabolomics' '10' 'Y'`
- eg. `python MPMF_Process_Raw_Files.py 'proteomics' '-1' 'N'`

## Starting MaSpeQC
After 5 QC runs have been processed for a machine, it is available for viewing in MaSpeQC. To start using MaSpeQC:
- Navigate to the __mpmf-server__ directory.
- Type `npm start`
- Open a browser window at your _localhost_ to start using MaSpeQC
- __NOTE__: An attempt will be made to establish a _https_ connection, however if this fails a _http_ connection is established. Modify the location of certificate/key in the _www_ file to establish a _https_ connection.

## Automating MaSpeQC
MaSpeQC can be configured to run automatically with the following steps:  
- First, set the database to run as a service by navigating to _/Software/mysql-5.7.41-winx64/bin_ and typing `mysqld --install`
- Then, configure the server to run continuously by navigating to _mpmf-server_ and typing:  
	- `npm install forever -g`
	- `forever start ./bin/www`
- Finally, set the Task Scheduler to run the processing scripts in this repository periodically (_runMetabolomics.bat_, _runProteomics.bat_)

## File Formats and Directory Structure
The raw QC input files are required to be stored in __instrument_name__ (defined in configuration) folders in the directory specified during configuration.
- ![in-folders](img/in-folders.PNG)

The required format for input file names is:
- QC_Metabolomics_TIMESTAMP.vendor
- QC_Proteomics_TIMESTAMP.vendor

Where,
- __TIMESTAMP__ = YYYYMMDDHHMMSS or YYYYMMDDHHMM
	- The Timestamp defines the time of the QC run. 
- __vendor__ is the vendor file format of the machine (.raw, .wiff, .d, .mzML)


## Metric Definitions

### Identification-free Metrics
- __Mass Error (ppm)__: A measure of instrument accuracy in parts-per-million.
- __Mass Error (mDa)__: A measure of instrument accuracy in milli-Daltons.
- __Retention Time__: Chromatographic elution times of the input compounds.
- __Full Width Half Maximum__: Measure of chromatographic peak width, defined as the width of the peak at half of the peak height.
- __Area (normalised)__: Area of chromatographic peak normalized by the log median values.
- __Height (normalised)__: Height of chromatographic peak normalized by the log median values.
- __Tailing__: A measure of skewness of a chromatographic peak.
- __Asymmetry__: A measure of skewness of a chromatographic peak.

### Identification-based Metrics (Proteomics Only)

- __MS/MS Spectra__: The total number of ms2 spectra present in the QC run.
- __Target PSMs__: The number of peptide spectrum matches (PSM), i.e. the number of ms2 spectra that are assigned to a peptide sequence.
- __Unique Target Peptides__: The number of identified unique peptide sequences.
- __Target Protein Groups__: The number of identified protein groups.
- __Precursor Mass Error__: The average mass error (in ppm) for all precursor ions.

### Pressure Metrics (Thermo Scientific Only)
All pressure metrics are derived from the pressure profile displayed in the top right corner of the charts page.
#### Main Pump (Metabolomics/Lipidomics Only)
- __Max Pressure__: Maximum recorded pressure during the run.
- __RT at Max Pressure__: Retention time of the maximum pressure.
- __Starting Pressure__: Median pressure during the first minute.
- __End Pressure__: Median pressure during the last minute.

#### Loading Pump (Proteomics Only)
- __Starting Back Pressure__: Average pressure during the first x minutes (x is set in configuration).
- __End Pressure__: Average pressure during the last x minutes (x is set in configuration).
- __Pressure Differential__: Pressure difference between the first and last minute of the gradient.
- __Air Injection__: Difference between the first reading and maximal reading during the initial 30 seconds of the gradient. Can be used to gauge whether air has been injected.
- __Valve Spike Start__: Max increase (in 10 second windows) during the first x minutes (x is set in configuration).
- __Valve Spike End__: Max increase (in 10 second windows) during the last x minutes (x is set in configuration).

#### Gradient Pump (Proteomics Only)
- __Starting Pressure__: Median pressure during the 2 minutes.
- __Valve Drop__: Difference between Starting Pressure and 1st profile trough.
- __Inline Leak__: Difference between Starting Pressure and 1st peak after the 1st profile trough.
- __Max Pressure__: Maximum recorded pressure during the run.
- __Min Pressure__: Minimum recorded pressure during the run.
- __Pressure Differential__: Pressure difference between the first and last minute of the gradient.

## Threshold Definitions
- Thresholds are set during initial configuration but can be adjusted from the web interface as well. When a threshold is breached, a notification email is sent to the Contacts defined during configuration (NOTE: sending of emails can be controlled during processing).
- Threshold markers also appear in the interface of the system. A triggered threshold appears as a exclamation ![exclamation](img/exclamation.PNG). When no thresholds are triggered, a run will be accompanied by a ![tick](img/tick.PNG). 

#### Thresholds for Identification-free metrics
- A _Trigger_ for an identification-free metric refers to the __number of input components__ that must register outside of the _Upper Threshold_ and _Lower Threshold_ range for a performance breach to be recorded for that metric.
- The _Upper Threshold_ and _Lower Threshold_ range is defined in the units of the metric unless marked as a percentile. Percentile ranges are statistical percentiles based on the full data range.
#### Thresholds for Identification-based metrics (Proteomics Only)
- All thresholds for identification-based metrics are defined in terms of percentiles except for Precursor Mass Error, which is defined in _ppm_.

# Using MaSpeQC
## Controls
All charts can be navigated and updated via the controls and menus. The __date controls__ at the top of the page can be used to switch between quality control runs.  
  
<div style='display:flex;justify-content:center;'>    
<img src="img/dateControls.png" alt="summary" height="50%" width="50%"/>
</div>
</br>

The __input components__ to the left of the chart area can be used to add/remove inputs from all of the charts. _Hold Ctrl_ when clicking on a component name to view that component individually. An __accordion menu__ is available from the chart controls to change between metrics. This will remain open and can be positioned anywhere on the page.

</br>
</br>
<div style='display:flex;justify-content:center;'>    
<img src="img/compControls.PNG" alt="summary" width="20%" style="diplay:inline;"/>
<img src="img/menuControls.PNG" alt="summary" width="35%" style="diplay:inline;"/>
</div>

The chart controls at the top of each chart can be used to change between time scales, and to select the number of runs displayed on a chart (where applicable).  
  
<div style='display:flex;justify-content:center;'>    
<img src="img/top-controls.PNG" alt="summary" width="80%" style="diplay:inline;"/>
</div>  
</br>
</br>
The chart controls at the bottom of each chart can be used to change between the different chart types.  
 </br> 
 </br>
<div style='display:flex;justify-content:center;'>    
<img src="img/bottom-controls.PNG" alt="summary" width="80%" style="diplay:inline;"/>
</div> 

## Charts

### Summary
<img src="img/summary.PNG" alt="summary" height="80%" width="80%"/>  
  
The __network chart__ summarises all identification-free and identification-based metrics and reports the average metric value of the selected input components. 
The length of each edge is determined by how far that input component is from its optimal value. Nodes with optimal readings will rest against their metric node.  

#### User Interaction  
- Hover over an input component node for its reading.
- Click on a metric name (node for MS2 metrics) to jump to the line chart for that metric.
- All nodes can be dragged and moved.
- Click on an input node to highlight it in all metrics. Double click any node to remove highlight.
- The date controls will animate the summary chart by moving the nodes allowing comparison between runs.  

### Line Charts  
<img src="img/linechart.png" alt="line" height="80%" width="80%"/>  
  
__Line charts__ show metric values over time for each of the selected input components. Shaded areas represent threshold breaches where applicable.

#### User Interaction 
- The _dashed vertical marker_ is positioned at the currently displayed run.
	- Use the date controls to move the marker between runs.
	- Click on a node to move the marker to that run.
	- Click on the marker itself to focus the chart. The y-axis will expand to highlight that run.
- Change the x-axis by clicking between _Time Scale_ and _Runs Scale_.
- Change the number of displayed runs using the numbered controls.
- Hover over a line to highlight that component.
- Click on a line to focus. The y-axis will expand to highlight that line.
- Hover over a node for its date and reading.
- Click and drag a chart area to focus.
- Double click anywhere to reset the chart.

### Stream Graph  
<img src="img/stream.PNG" alt="line" height="80%" width="80%"/>
<img src="img/streamExpand.PNG" alt="line" height="80%" width="80%"/>  
      
__Stream graphs__ show metric values over time for each of the selected input components. They can be viewed as stacked area charts where the y-axis shows accumulated absolute totals, or as 100% stacked area charts where the y-axis shows the percentage of the total readings.

#### User Interaction 
- The _dashed vertical marker_ is positioned at the currently displayed run.
	- Click on the marker to switch between modes.
	- Hover over the marker to highlight that run.
	- Use the date controls to move the marker between runs.
- Change the x-axis by clicking between Time Scale and Runs Scale.
- Change the number of displayed runs using the numbered controls.
- Hover over a stream to highlight that component.
- Click on a stream to reposition it as the top stream (identification-based metrics only).

### Parallel Graph  
<img src="img/parallel.PNG" alt="line" height="80%" width="80%"/>  
     
__Parallel graphs__ show all of the metrics (identification-free or identification-based) on the one chart for the selected components. The axes are centered around their optimal values where applicable. 

#### User Interaction
- Use the date controls to move the components to their new readings.
- Click on the nodes of an axis to focus the input components for that metric. Click again to reset.
- Hover over a line to highlight that component across all metrics.

### Box Plots
<img src="img/boxplot.png" alt="line" height="80%" width="80%"/>  
  
__Box plots__ show a metric value on the display date (circle) in relation to its median and interquartile range. Shaded areas represent threshold breaches where applicable.

#### User Interaction 
- The date controls will transition the circle to its new reading.
- Double click anywhere on the chart to sort the boxes by their current run reading.
- Click a box to focus. The y-axis will expand to highlight that box.
	- Click the box again to reset.
- Hover over a circle for the current run details.
- Hover over a box for the box stats.

### Heat Maps
<img src="img/heatmap.png" alt="line" height="80%" width="80%"/>  
  
Each column of a __heat map__ shows an individual component over time for that metric, and each row shows an individual QC run.

#### User Interaction
- The _dashed horizontal marker_ is positioned at the currently displayed run.
	- Use the date controls to move the marker between runs.
- Hover over a cell for details.
- Hover over an input component circle to highlight.
- Hover over the current run row to highlight.
- NOTE: The maximum number of runs viewable on a heat map is 40.
	
### Ridge Lines
<img src="img/ridge.png" alt="line" height="80%" width="80%"/>  
  
__Ridge lines__ show the chromatograms of the selected components on one chart ordered by their expected retention time. The heights of the peaks are normalised by default.

#### User Interaction
- Click on any chromatogram to rescale the y-axis to that chromatogram. Click again to reset.
- Hover over an input component circle to highlight.
- Use the date controls to change the chromatograms.


### Chromatograms
<img src="img/chromatogram.PNG" alt="line" height="30%" width="30%"/>  
</br>
</br>

Click on a component name to view the __chromatogram__ for that component on the date shown. Chromatograms can also be updated from the charts when component nodes are clicked.

#### User Interaction
- Click and drag the chart area to focus. Double click to reset.
- Hover over a chromatogram to view a pop-up modal of all the metric readings for that component.
- When a chromatogram is clicked, the modal will remain open and will be updated.  
  
<img src="img/chromModal.PNG" alt="line" height="30%" width="30%"/>

### Pressure Profiles (Thermo Scientific Only)
<img src="img/pressure.PNG" alt="line" height="30%" width="30%"/>  
  
For Thermo Scientific instrumentation, a __pressure profile__ will be displayed at the top right of the page.

#### User Interaction
- Click and drag the chart area to focus. Double click to reset.
- Hover over a profile to view a pop-up modal of all the pressure metric readings.
- When a profile is clicked, the modal will remain open and will be updated.

<img src="img/pressureModal.PNG" alt="line" height="30%" width="30%"/>

## Help and Support
- Consult the __User Guides__ from the navigation menu for UI and common use cases.
	- https://youtu.be/_4T2WQHC5SY (Configuration)
	- https://youtu.be/wXOK1BTWMlE (Charts)
- __NOTE:__ The system creates its own check files (METABOLOMICS.txt, PROTEOMICS.txt) when processing. These can linger in the __mpmf-pipeline__ directory if processing is terminated early. Remove these from the directory before processing again.
