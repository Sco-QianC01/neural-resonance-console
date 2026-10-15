"""Build Chopin-only catalog from preserved anonymous public data; no media download."""
from pathlib import Path
import csv,hashlib,json
ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=ROOT/'artifacts/chopin-catalog-20261012'
TITLES={6:'肖邦 · 降D大調夜曲 Op.27 No.2',4040:'肖邦 · 降E大調夜曲 Op.9 No.2'}
NAMES={'Vladimir de Pachmann':'帕赫曼','Arthur Rubinstein':'魯賓斯坦',"Fou Ts'ong":'傅聰','Daniel Barenboim':'巴倫博伊姆','Lang Lang':'郎朗','Alfred Cortot':'科托','Yundi Li':'李雲迪','Alexis Weissenberg':'魏森伯格','Dang Thai Son':'鄧泰山','Ivan Moravec':'莫拉維茨'}
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def build():
 listing=json.loads((EVIDENCE/'contents-chopin.json').read_text())
 assert listing['ok'] and len(listing['items'])==listing['total']
 assert all(i['composer']=='Frederic Chopin' for i in listing['items'])
 study={}
 for case,path in [('2-4',EVIDENCE/'case-2-4.json'),('3-5',EVIDENCE/'case-3-5.json')]:
  for rec in json.loads(path.read_text())['recordings']:
   for m in rec['media']:study[m['media_id']]=(case,rec,m,path)
 rows=[];works=[];performances=[]
 for work_id,title in TITLES.items():
  path=EVIDENCE/f'work-{work_id}.json';work=json.loads(path.read_text())
  assert work['ok'] and work['viewer'] is None
  works.append({'id':work_id,'title':title,'composer':work['work']['composer'],'catalog':work['work']['catalog_no'],'reference':f'https://v3.vmus.net/demo1/#/work/{work_id}','sourceDataSha256':digest(path)})
  for perf in work['performances']:
   person=' / '.join(NAMES.get(c['name'],c['name']) for c in perf['performers']) or '演奏者未註明'
   perf_id=perf['performance_id']
   performances.append({'id':perf_id,'workId':work_id,'performer':person,'year':perf['perf_year'],'provenance':perf['provenance'],'credits':perf['performers']})
   for m in perf['media']:
    key=m['media_id'];public=next(i for i in listing['items'] if i['media_id']==key)
    assert public['media_url']==m['media_url']
    cp=EVIDENCE/f'annotation-{key}.csv';pts=list(csv.DictReader(cp.read_text(encoding='utf-8-sig').splitlines()))
    times=[float(x['TIME']) for x in pts];labels=[x['LABEL'] for x in pts]
    assert len(times)>=2 and all(x<y for x,y in zip(times,times[1:]))
    a={'kind':'onsets','t':times,'labels':labels,'version':m['annotation']['version'],'descr':m['annotation']['descr']}
    row={'id':f'vmus-{key}','mediaId':key,'performanceId':perf_id,'workId':work_id,'title':title,'performer':person,'year':perf['perf_year'],'provenance':perf['provenance'],
      'credits':[{'name':c['name'],'zh':NAMES.get(c['name'],c['name']),'role':c['role']} for c in perf['performers']],
      'disc':perf['note'] or '', 'media':m['media_url'],'mediaType':m['media_type'],'duration':m['duration'],'excerpt':m['label'] or f'曲目庫音訊 {key}',
      'reference':f'https://v3.vmus.net/demo1/#/work/{work_id}','annotationReference':f'https://v3.vmus.net/demo1/api/annotation_csv.php?media_id={key}',
      'annotationUser':m['annotation']['user_name'],'annotationCsvSha256':digest(cp),'sourceDataSha256':digest(path),'annotation':a,'annotations':[a],'completeStudy':False}
    if key in study:
     case,rec,item,src=study[key];assert item['url']==row['media']
     annotations=item['annotations'];primary=next((x for x in annotations if x['kind']=='beats'),annotations[0])
     if primary['kind']=='beats':
      row['id']=rec['key'];row['completeStudy']=True
      assert primary['amp']['dt']>0 and all(0<=v<=100 for v in primary['amp']['v'])
     row.update(case=case,annotation=primary,annotations=annotations,duration=item['duration'],excerpt=item['label'],clipLabel=item.get('section_zh') or item.get('section'),reference=f'https://v3.vmus.net/studies/yang2007/#case={case}&view=tempo',sourceDataSha256=digest(src))
    rows.append(row)
 rows.sort(key=lambda r:(r['workId'],not r['completeStudy'],r['year'] or 9999,r['performanceId'],r['mediaId']))
 assert len(rows)==40 and len(performances)==15 and sum(r['completeStudy'] for r in rows)==10
 assert {r['mediaId'] for r in rows}=={i['media_id'] for i in listing['items']}
 assert len(set(r['id'] for r in rows))==len(rows)
 doc={'schema':'vmus-reference-cases-v1','checkedDate':'2026-10-12','source':'Vmus.net V3 public Chopin catalog + Yang 2007',
  'attribution':'Yang 2007 拍點／相對力度資料 © 楊健／上海音樂學院；歷史標注保留原站署名。',
  'mediaPolicy':'原站公開音訊以原網址串流引用；錄音權利歸相應權利人，本站不提供音訊副本或再授權。',
  'method':'已確認拍值：tempo=60×w/IOI；高斯窗W=2σ。只有TIME,LABEL的歷史標注保留發音間隔，不猜拍值或力度。灰帶是相對力度顯示，不是置信區間。',
  'coverage':{'works':2,'performances':15,'media':40,'completeStudy':10,'studyMedia':len(study),'publicAnnotations':40,'unknownPerformers':2},
  'catalogReference':'https://v3.vmus.net/demo1/api/contents.php?q=Chopin&size=100&page=1','catalogSha256':digest(EVIDENCE/'contents-chopin.json'),
  'works':works,'performances':performances,'recordings':rows}
 target=ROOT/'public/research/vmus-reference-cases.json';target.write_text(json.dumps(doc,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
 (EVIDENCE/'catalog-inventory.json').write_text(json.dumps({'coverage':doc['coverage'],'works':works,'performances':performances,'media':[{k:r[k] for k in ['id','mediaId','performanceId','workId','performer','year','media','completeStudy','annotationUser','annotationCsvSha256']} for r in rows]},ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'coverage':doc['coverage'],'bytes':target.stat().st_size,'audioDownloaded':False}))
if __name__=='__main__':build()
