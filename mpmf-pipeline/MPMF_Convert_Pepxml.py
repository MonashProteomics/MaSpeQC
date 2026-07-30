# MaSpeQC - Quality control software for LC-MS/MS instrumentation
#
# Copyright (C) 2018-2025  Simon Caven
# Copyright (C) 2020-2025  Monash University
# Copyright (C) 2022-2025  University of Applied Sciences Mittweida
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

import lxml.etree as ET
import pandas as pd
import datetime
import math
import os
import logging
logger = logging.getLogger('processing.convert_pepxml')


class ConvertPepxml:
    """
        Creates pep.xml for use with ProteinProphet
        from Percolator psm .tsvs and MSFragger .pin
           
    """
    def __init__(self, base_dir, base_name, min_prob=0.5):

        self.base_dir = base_dir
        self.base_name = base_name
        self.min_prob = min_prob
        self.xml_file = os.path.join(base_dir, base_name + ".pepXML")
        self.output_file = os.path.join(base_dir, "converted.pep.xml")
        
        # set pin
        fragger_pin = os.path.join(base_dir, base_name + ".pin")
        booster_pin = os.path.join(base_dir, base_name + "_edited.pin")
        self.pin_file = booster_pin if os.path.exists(booster_pin) else fragger_pin

        # set tsvs
        self.target_psms_file = os.path.join(base_dir, "targets.tsv")
        self.decoy_psms_file = os.path.join(base_dir, "decoys.tsv")

        # set dictionaries
        self.pin_spectrum_dict = self.set_pin_dict()
        self.tsv_spectrum_dict = self.set_percolator_dict()

    
    def set_pin_dict_old(self):

        # creates a dict from .pin file
        
        with open(self.pin_file, 'r') as f:
            lines = f.readlines()
        
        # header
        colnames = lines.pop(0).strip().split('\t')

        # indexes for desired pin columns
        idx_specid = colnames.index("SpecId")
        idx_ntt = colnames.index("ntt")
        idx_nmc = colnames.index("nmc")
        idx_rt_score = colnames.index("delta_RT_loess_real") if "delta_RT_loess_real" in colnames else -1
        idx_spectral_sim = colnames.index("unweighted_spectral_entropy") if "unweighted_spectral_entropy" in colnames else -1

        # create the pin dict
        pin_spectrum_dict = {}
        for line in lines:
            fields = line.strip().split('\t')
            spec_id = fields[idx_specid][:-2]  # remove rank suffix for spectrum id as seen in pepXML
            ntt = int(fields[idx_ntt])
            nmc = int(fields[idx_nmc])
            rt_score = float(fields[idx_rt_score]) if idx_rt_score != -1 else math.nan
            spectral_sim = float(fields[idx_spectral_sim]) if idx_spectral_sim != -1 else math.nan

            pin_spectrum_dict[spec_id] = {"ntt":ntt, "nmc":nmc, "rt_score":rt_score, "spectral_sim":spectral_sim}
        
        return pin_spectrum_dict

    def set_pin_dict(self):
    
        # creates a dict from .pin file

        # read the .pin file into a pandas DataFrame
        df = pd.read_csv(self.pin_file, sep='\t', usecols=lambda col_name: col_name in ['SpecId', 'ntt', 'nmc', 'delta_RT_loess_real', 'unweighted_spectral_entropy'])

        # remove rank suffix for spectrum id as seen in pepXML
        df['SpecId'] = df['SpecId'].str[:-2]

        # add missing columns
        if 'delta_RT_loess_real' not in df.columns:
            df['delta_RT_loess_real'] = math.nan
        if 'unweighted_spectral_entropy' not in df.columns:
            df['unweighted_spectral_entropy'] = math.nan

        # convert to dictionary and return
        return df.set_index('SpecId').to_dict(orient='index')
    
    
    def set_percolator_dict_old(self):

        # creates a dict from .tsv files
        
        tsv_spectrum_dict = {}
        for tsv_path in [self.target_psms_file, self.decoy_psms_file]:
            with open(tsv_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # header
            colnames = lines.pop(0).strip().split('\t')

            # indexes for desired tsv columns
            idx_psmid = colnames.index("PSMId")
            idx_pep = colnames.index("posterior_error_prob")
            idx_score = colnames.index("score")

            # create the tsv dict
            for line in lines:
                fields = line.strip().split('\t')
                spec_id = fields[idx_psmid][:-2]  # remove rank suffix for spectrum id as seen in pepXML

                # get pep prob
                try:
                    pep = float(fields[idx_pep])
                except ValueError:
                    pep = 1.0

                # filter on pep prob (FILTERS <spectrum_query>)
                if (1.0 - pep) >= self.min_prob:

                    # get score
                    try:
                        score = float(fields[idx_score])
                    except ValueError:
                        score = 0.0

                    tsv_spectrum_dict[spec_id] = {"pep":pep, "score":score}

        return tsv_spectrum_dict
    
    def set_percolator_dict(self):
    
        # creates a dict from .tsv files

        tsv_spectrum_dict = {}
        for psms_file in [self.target_psms_file, self.decoy_psms_file]:

            # read the .tsv file into a pandas DataFrame
            df = pd.read_csv(psms_file, sep='\t', usecols=['PSMId', 'score', 'posterior_error_prob'])

            # remove rank suffix for spectrum id as seen in pepXML
            df['PSMId'] = df['PSMId'].str[:-2]

            # force posterior_error_prob to float, turning bad values into NaN (errors='coerce'), then fill NaNs with 1.0 (.fillna(1.0))
            df['posterior_error_prob'] = pd.to_numeric(df['posterior_error_prob'], errors='coerce').fillna(1.0)

            # filter data frame update score
            mask = (1.0 - df['posterior_error_prob']) >= self.min_prob

            # .copy() safely detaches the filtered data from the original DataFrame
            df_filtered = df[mask].copy()

            # force score to float, turning bad values into NaN (errors='coerce'), then fill NaNs with 0.0 (.fillna(0.0))
            df_filtered['score'] = pd.to_numeric(df_filtered['score'], errors='coerce').fillna(0.0)

            # convert to dictionary
            # TODO: do we have colliding keys? ... not for DDA ?
            tsv_spectrum_dict.update(df_filtered.set_index('PSMId').to_dict(orient='index'))
            
        return tsv_spectrum_dict
    
    def set_metadata_in_stream(self, xf, indent):

        now = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

        # analysis_summary element (percolator)
        analysis_summary = ET.Element('analysis_summary', attrib={"analysis": "percolator", "time": now})
        peptideprophet_summary = ET.Element('peptideprophet_summary', attrib={"min_prob": str(self.min_prob)})
        input_file = ET.Element('inputfile', attrib={"name": self.xml_file}) 
        peptideprophet_summary.append(input_file)
        analysis_summary.append(peptideprophet_summary)
        xf.write(indent)
        xf.write(analysis_summary)

        # analysis_summary element (database_refresh)
        analysis_summary = ET.Element('analysis_summary', attrib={"analysis": "database_refresh", "time": now})
        xf.write(indent)
        xf.write(analysis_summary)

        # analysis_summary element (interact)
        analysis_summary = ET.Element('analysis_summary', attrib={"analysis": "interact", "time": now})
        interact_summary = ET.Element('interact_summary', attrib={"filename": self.output_file, "directory": ""})
        input_file = ET.Element('inputfile', attrib={"name": self.xml_file}) # create again , not needed?
        interact_summary.append(input_file)
        analysis_summary.append(interact_summary)
        xf.write(indent) 
        xf.write(analysis_summary)

        # dataset_derivation element 
        new_el = ET.Element('dataset_derivation', attrib={"generation_no": "0"})
        xf.write(indent) 
        xf.write(new_el)
        xf.write(indent)

 
    def update_spectrum_query_old(self, ns, sq, spectrum):

        # set locally for clarity
        tsv = self.tsv_spectrum_dict
        pin = self.pin_spectrum_dict

        # search tags
        search_result = sq.find('.//{}search_result'.format(ns))
        search_hit = search_result.find('.//{}search_hit'.format(ns))
         
        # search hit variables
        massdiff = float(search_hit.attrib['massdiff'])
        calc_neutral_pep_mass = float(search_hit.attrib['calc_neutral_pep_mass'])

        # calculate isoptope mass difference (isotopic mass shift)
        gap = float('inf')
        isomassd = 0
        C13C12_MASSDIFF_U = 1.0033548378
        for isotope in range(-6, 7):
            current_gap = abs(massdiff - isotope * C13C12_MASSDIFF_U)
            if current_gap < gap:
                gap = current_gap
                isomassd = isotope

        if gap > 0.1:
            isomassd = 0

        # calculated variables
        prob = 1.0 - tsv[spectrum]["pep"]
        massd_val = (massdiff - isomassd * C13C12_MASSDIFF_U) * 1000000.0 / calc_neutral_pep_mass

        #### update the XML
        if not math.isnan(pin[spectrum]["spectral_sim"]):
            # update search hit with search scores (spectral sim)
            search_score = ET.Element('search_score')
            search_score.set('name', 'spectralsim')
            search_score.set('value', str(pin[spectrum]["spectral_sim"]))
            search_hit.append(search_score)

        if not math.isnan(pin[spectrum]["rt_score"]):
            # update search hit with search scores (rt score)
            search_score = ET.Element('search_score')
            search_score.set('name', 'rtscore')
            search_score.set('value', str(pin[spectrum]["rt_score"]))
            search_hit.append(search_score)

        # peptideprophet analysis result
        analysis_result = ET.Element('analysis_result')
        analysis_result.set('analysis', 'peptideprophet')

        # peptideprophet result summary
        result_summary = ET.Element('peptideprophet_result')
        result_summary.set('probability', str(prob))
        result_summary.set('all_ntt_prob', "({prob:f},{prob:f},{prob:f})".format(prob=prob))

        # search score summary
        search_score_summary = ET.Element('search_score_summary')

        # parameters for search score summary
        parameters = [
            ('fval', str(tsv[spectrum]["score"])),
            ('ntt', str(pin[spectrum]["ntt"])),
            ('nmc', str(pin[spectrum]["nmc"])),
            ('massd', str(massd_val)),
            ('isomassd', str(isomassd))
        ]

        # append to search score summary
        for name, value in parameters:
            parameter = ET.Element('parameter')
            parameter.set('name', name)
            parameter.set('value', value)
            search_score_summary.append(parameter)

        # append to document
        result_summary.append(search_score_summary)
        analysis_result.append(result_summary)
        search_hit.append(analysis_result)

    def update_spectrum_query(self, ns, sq, spectrum):

        # set locally for clarity
        tsv = self.tsv_spectrum_dict
        pin = self.pin_spectrum_dict

        # pad scan number with zeros in spectrum id to length 5
        spectrum = sq.attrib['spectrum']
        s = spectrum.split('.')
        if (s[1] == s[2]):
            sq.set('spectrum', s[0] + '.' + s[1].zfill(5) + '.' + s[2].zfill(5) + '.' + s[3])
        else:
            logger.error('Error parsing scan number for spectrum ' + str(spectrum))
            return False

        # search tags
        search_result = sq.find('.//{}search_result'.format(ns))
        search_hit = search_result.find('.//{}search_hit'.format(ns))
        
        # search hit variables
        massdiff = float(search_hit.attrib['massdiff'])
        calc_neutral_pep_mass = float(search_hit.attrib['calc_neutral_pep_mass'])

        # calculate isoptope mass difference (isotopic mass shift)
        gap = math.inf
        isomassd = 0
        C13C12_MASSDIFF_U = 1.0033548378
        for isotope in range(-6, 7):
            current_gap = abs(massdiff - isotope * C13C12_MASSDIFF_U)
            if current_gap < gap:
                gap = current_gap
                isomassd = isotope

        if gap > 0.1:
            isomassd = 0

        # calculated variables
        prob = 1.0 - tsv[spectrum]["posterior_error_prob"]
        massd_val = (massdiff - isomassd * C13C12_MASSDIFF_U) * 1000000.0 / calc_neutral_pep_mass

        # update the XML
        if not math.isnan(pin[spectrum]["unweighted_spectral_entropy"]):
            # update search hit with search scores (unweighted_spectral_entropy)
            search_score = ET.Element('search_score', attrib={'name': 'spectralsim', 'value': "{:.6f}".format(pin[spectrum]["unweighted_spectral_entropy"])})
            search_hit.append(search_score)

        if not math.isnan(pin[spectrum]["delta_RT_loess_real"]):
            # update search hit with search scores (delta_RT_loess_real)
            search_score = ET.Element('search_score', attrib={'name': 'rtscore', 'value': "{:.6f}".format(pin[spectrum]["delta_RT_loess_real"])})
            search_hit.append(search_score)

        # peptideprophet analysis result
        analysis_result = ET.Element('analysis_result', attrib={'analysis': 'peptideprophet'})

        # peptideprophet result summary
        result_summary = ET.Element('peptideprophet_result', attrib={'probability': "{:.6f}".format(prob), 'all_ntt_prob': "({prob:.6f},{prob:.6f},{prob:.6f})".format(prob=prob)})

        # search score summary
        search_score_summary = ET.Element('search_score_summary')

        # parameters for search score summary
        parameters = [
            ('fval', "{:.6f}".format(tsv[spectrum]["score"])),
            ('ntt', str(pin[spectrum]["ntt"])),
            ('nmc', str(pin[spectrum]["nmc"])),
            ('massd', "{:.6f}".format(massd_val)),
            ('isomassd', str(isomassd))
        ]

        # append to search score summary
        for name, value in parameters:
            parameter = ET.Element('parameter', attrib={'name': name, 'value': value})
            search_score_summary.append(parameter)

        # append to document
        result_summary.append(search_score_summary)
        analysis_result.append(result_summary)
        search_hit.append(analysis_result)

        return True

    def stream_and_write_xml_old(self):

        context = ET.iterparse(self.xml_file, events=('start', 'end'))
        _, root = next(context) 
        indent_level_1 = "\n"
        ns = root.tag.split('}')[0] + '}'
        msms_summary = None
        tsv = self.tsv_spectrum_dict

        with open(self.output_file, 'wb') as f:
            with ET.xmlfile(f, encoding='utf-8', buffered=False) as xf:

                xf.write_declaration()
                
                with xf.element(root.tag, attrib=root.attrib, nsmap=root.nsmap):

                    # --- Insert Metadata ---
                    self.set_metadata_in_stream(xf, indent_level_1)
                    
                    # Find the msms_run_summary element (main container)
                    for event, elem in context:
                        if event == 'start' and elem.tag == f'{ns}msms_run_summary':
                            msms_summary = elem
                            break
                        else: # only reached if not well formed XML
                            xf.write(elem)
                            elem.clear()

                    # Start again from msms_summary and process its children
                    if msms_summary is not None:
                        with xf.element(msms_summary.tag, attrib=msms_summary.attrib):      

                            for event, elem in context:
                                # Process only direct children of msms_summary
                                if event == 'end' and elem.getparent() == msms_summary:

                                    # Handle spectrum query elements based on tsv dict
                                    if elem.tag == f'{ns}spectrum_query':
                                        spectrum = elem.attrib['spectrum']
                                        if spectrum in tsv:

                                            # --- Update spectrum query with new data and write to file ---
                                            self.update_spectrum_query(ns, elem, spectrum)
                                            xf.write(elem)
                                            elem.clear()
                                        else:
                                            # Skip writing this element and clear it from memory
                                            elem.clear()
                                    else:
                                        # Serialize and stream other elements directly to the target file
                                        xf.write(elem)
                                        elem.clear()
                                # Stop when we hit the end tag of the msms_summary
                                elif event == 'end' and elem == msms_summary:
                                    break
                    else:
                        logger.error("msms_run_summary element not found in the XML file.")
                        return False
                            
                    # Clear root 
                    root.clear() 

        return True

    def stream_and_write_xml(self):

        context = ET.iterparse(self.xml_file, events=('start', 'end'))
        _, root = next(context) 
        indent_level_1 = "\n"
        ns = root.tag.split('}')[0] + '}'
        msms_summary = None
        tsv = self.tsv_spectrum_dict
        
        # XSLT that copies elements and attributes but ignores namespaces
        xslt_template = ET.XML("""
            <xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
                <!-- rebuild elements using only their local name (no prefix) -->
                <xsl:template match="*">
                    <xsl:element name="{local-name()}">
                        <xsl:apply-templates select="@*|node()"/>
                    </xsl:element>
                </xsl:template>
                <!-- rebuild attributes using only their local name -->
                <xsl:template match="@*">
                    <xsl:attribute name="{local-name()}">
                        <xsl:value-of select="."/>
                    </xsl:attribute>
                </xsl:template>
            </xsl:stylesheet>
        """)
        # compile the transformation
        strip_ns_fast = ET.XSLT(xslt_template)

        with open(self.output_file, 'wb') as f:
            with ET.xmlfile(f, encoding='utf-8', buffered=False) as xf:

                xf.write_declaration()
                
                with xf.element(root.tag, attrib=root.attrib, nsmap=root.nsmap):

                    # --- Insert Metadata ---
                    self.set_metadata_in_stream(xf, indent_level_1)
                    
                    # Find the msms_run_summary element (main container)
                    for event, elem in context:
                        if event == 'start' and elem.tag == f'{ns}msms_run_summary':
                            msms_summary = elem
                            break
                        else: # only reached if not well formed XML
                        
                            # apply XSLT transformation, .getroot() extracts the clean element from the XSLT result tree
                            clean_elem = strip_ns_fast(elem).getroot()
                            xf.write(clean_elem)
                            elem.clear()

                    # Start again from msms_summary and process its children
                    if not msms_summary is None:
                        with xf.element(msms_summary.tag, attrib=msms_summary.attrib):

                            for event, elem in context:
                                # Process only direct children of msms_summary
                                if event == 'end' and elem.getparent() == msms_summary:

                                    # Handle spectrum query elements based on tsv dict
                                    if elem.tag == f'{ns}spectrum_query':
                                        spectrum = elem.attrib['spectrum']
                                        if spectrum in tsv:

                                            # --- Update spectrum query with new data and write to file ---
                                            if not self.update_spectrum_query(ns, elem, spectrum):
                                                return False
                                            
                                            # apply XSLT transformation, .getroot() extracts the clean element from the XSLT result tree
                                            clean_elem = strip_ns_fast(elem).getroot()
                                            xf.write(clean_elem)
                                            elem.clear()
                                        else:
                                            # Skip writing this element and clear it from memory
                                            elem.clear()
                                    else:
                                        # Serialize and stream other elements directly to the target file
                                        
                                        # apply XSLT transformation, .getroot() extracts the clean element from the XSLT result tree
                                        clean_elem = strip_ns_fast(elem).getroot()
                                        xf.write(clean_elem)
                                        elem.clear()
                                # Stop when we hit the end tag of the msms_summary
                                elif event == 'end' and elem == msms_summary:
                                    break
                    else:
                        logger.error("msms_run_summary element not found in the XML file.")
                        return False
                                   
                    # Clear root 
                    root.clear() 

        return True
    
if __name__ == "__main__":
    # testing FROM outfiles directory
    outfiles_dir = os.getcwd()
    filename = 'QC_Proteomics_20240627134019_pos'
    cp_obj = ConvertPepxml(outfiles_dir, filename, 0.5)
    print(cp_obj.stream_and_write_xml())

    # HERE
    # remove old functions and test code before committing to main branch