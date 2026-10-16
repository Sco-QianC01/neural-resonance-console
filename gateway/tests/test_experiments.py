import base64
import copy
import csv
import json
from pathlib import Path
import sys
import tempfile
import unittest
from datetime import datetime
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from experiments import save_experiment, validate, correlation, results_root

class ExperimentTests(unittest.TestCase):
    def test_result_directory_never_probes_another_project_on_the_host(self):
        fallback=Path('private-user-data')
        with patch('experiments.Path.is_dir',return_value=True):
            self.assertEqual(results_root(fallback),fallback/'results')
    def test_export_names_work_with_ascii_only_platform_date_formatters(self):
        class AsciiDateTime(datetime):
            def strftime(self, format):
                format.encode('ascii')
                return super().strftime(format)
        with tempfile.TemporaryDirectory() as root, patch('experiments.datetime', AsciiDateTime):
            destination=save_experiment(self.payload(),root)
            self.assertIn('聆听实验',destination.name)
            self.assertTrue((destination/'experiment.json').is_file())
    def payload(self):
        image='data:image/png;base64,'+base64.b64encode(b'\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR'+b'\x00\x00\x00\x01'*2+b'\x08\x06\x00\x00\x00'+b'1234').decode()
        rows=[{'source':'device','transport':'usb','mediaTime':i,'indexTime':i*1000,'packetTime':i*1000,'attention':20+i,'relaxation':60-i,'tempo':90+i,'level':None} for i in range(3)]
        trial={'schema':'neural-listening-trial-v1','recording':{'id':'one','workId':6,'title':'肖邦','performer':'测试','year':1925},'rows':rows,'packets':[{'source':'device','transport':'usb','rawEegSamples':[-2,2]}]}
        return {'schema':'neural-listening-experiment-v1','trials':[trial],'image':image}
    def test_preserve_raw_data_and_immutable_utf8_exports(self):
        with tempfile.TemporaryDirectory() as root:
            first=save_experiment(self.payload(),root);second=save_experiment(self.payload(),root)
            self.assertNotEqual(first,second)
            data=json.loads((first/'experiment.json').read_text(encoding='utf-8'))
            self.assertEqual(data['trials'][0]['packets'][0]['rawEegSamples'],[-2,2])
            self.assertEqual(data['trials'][0]['statistics']['tempoRelaxation']['r'],-1)
            self.assertTrue((first/'paired.csv').read_bytes().startswith(b'\xef\xbb\xbf'))
            self.assertIn('肖邦',(first/'report.html').read_text(encoding='utf-8'))
            self.assertEqual(len(list(first.iterdir())),4)
    def test_reject_fake_sources_missing_data_duplicate_versions_and_nonfinite(self):
        for change in ['demo','empty','duplicate','inf','time']:
            p=self.payload()
            if change=='demo':p['trials'][0]['rows'][0]['source']='demo'
            if change=='empty':p['trials'][0]['rows']=[]
            if change=='duplicate':p['trials'].append(copy.deepcopy(p['trials'][0]))
            if change=='inf':p['trials'][0]['rows'][0]['attention']=float('inf')
            if change=='time':p['trials'][0]['rows'][1]['indexTime']=0
            with self.assertRaises(ValueError):validate(p)
    def test_correlation_has_no_unjustified_value(self):
        self.assertEqual(correlation([{'x':1,'y':2}]*4,'x','y'),{'n':4,'r':None})
        self.assertEqual(correlation([{'x':None,'y':2}],'x','y'),{'n':0,'r':None})
    def test_csv_keeps_integer_bar_separate_from_within_bar_position(self):
        value=self.payload()
        value['trials'][0]['rows'][0].update(bar=2,barPosition=2.5,beatInBar=3,beatsPerBar=6,
                                          level=19.5,levelSource='vmus-2007-smoothed-amplitude',
                                          levelUnit='source-relative-0-100',dynamicMark=None,dynamicTier=None)
        with tempfile.TemporaryDirectory() as root:
            target=save_experiment(value,root)
            with (target/'paired.csv').open(encoding='utf-8-sig',newline='') as handle:
                row=next(csv.DictReader(handle))
            self.assertEqual(row['bar'],'2')
            self.assertEqual(row['barPosition'],'2.5')
            self.assertEqual(row['beatInBar'],'3')
            self.assertEqual(row['beatsPerBar'],'6')
            self.assertEqual(row['level'],'19.5')
            self.assertEqual(row['levelSource'],'vmus-2007-smoothed-amplitude')
            self.assertEqual(row['levelUnit'],'source-relative-0-100')
            self.assertEqual(row['dynamicMark'],'')
            self.assertEqual(row['dynamicTier'],'')
