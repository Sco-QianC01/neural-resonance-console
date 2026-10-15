"""Isolated native Edge acceptance; fixtures remain visibly synthetic."""
import asyncio,json,sys,argparse,mimetypes,importlib.util
import hashlib
from urllib.parse import urlparse,unquote
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
if importlib.util.find_spec('playwright') is None:
    sys.path.insert(0,str(ROOT/'artifacts/worm-academic-20261010/qa-python'))
from playwright.async_api import async_playwright
from PIL import Image,ImageStat
OPTIONS=argparse.ArgumentParser()
OPTIONS.add_argument('--source',action='store_true')
OPTIONS.add_argument('--quick',action='store_true')
OPTIONS.add_argument('--probe',action='store_true')
OPTIONS.add_argument('--theme-probe',action='store_true')
OPTIONS.add_argument('--raw-doc-probe',action='store_true')
OPTIONS.add_argument('--doc-probe',action='store_true')
OPTIONS.add_argument('--fusion-probe',action='store_true')
OPTIONS.add_argument('--chopin-probe',action='store_true')
OPTIONS.add_argument('--wire-probe',action='store_true')
OPTIONS.add_argument('--phase',choices=['initial','polish','unified','reader','fusion','chopin'],default='initial')
OPTIONS=OPTIONS.parse_args()
MODE='source' if OPTIONS.source else 'live'
OUT=ROOT/({'initial':'artifacts/planar-worm-20261011','polish':'artifacts/planar-polish-20261011','unified':'artifacts/planar-unified-20261011','reader':'artifacts/method-reader-20261011','fusion':'artifacts/music-fusion-20261011','chopin':'artifacts/chopin-catalog-20261012'}[OPTIONS.phase]+'/windows-browser')
OUT.mkdir(parents=True,exist_ok=True)
async def instrument_page(browser,**options):
    page=await browser.new_page(**options)
    await page.context.grant_permissions(['local-network-access'],origin='http://127.0.0.1:8767')
    return page
def mode_selector(mode):
    return f'.sidebar #{mode}' if OPTIONS.phase in ['unified','fusion','reader','chopin'] else f'#research-worm [data-mode={mode}]'
async def select_mode(page,mode):
    mobile=OPTIONS.phase in ['unified','fusion','reader','chopin'] and page.viewport_size['width']<=760
    if mobile:await page.locator('#nav-toggle').click()
    await page.locator(mode_selector(mode)).click()
    if mobile:await page.keyboard.press('Escape')
async def source_route(route):
    name=unquote(urlparse(route.request.url).path)
    if name=='/':name='/index.html'
    if name=='/public/config.json':
        await route.continue_();return
    if name=='/index.html' or name.startswith(('/src/','/public/','/neural-worm/','/docs/')):
        file=(ROOT/name.lstrip('/')).resolve()
        if file.is_relative_to(ROOT) and file.is_file():
            content_type='text/javascript' if file.suffix in ('.js','.mjs') else mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
            await route.fulfill(body=file.read_bytes(),content_type=content_type);return
    await route.continue_()
async def shot(page,name,full=False):
    path=OUT/name
    await page.screenshot(path=str(path),full_page=full)
    with Image.open(path) as image:
        image.thumbnail((1280,1280))
        image.convert('RGB').save(path.with_name(path.stem+'-preview.jpg'),quality=87)
def fixture(full_music=False):
    rows=[]
    for i in range(32):
        t=1+i*.2+(4 if i>=24 else 0)
        amplitude=10 if i<12 else 200
        row={'schemaVersion':'neural-resonance-live-v1','source':'demo','sessionId':'synthetic-qa',
             'ts':t,'attention':60,'meditation':70,'rawUnit':'ADC counts','sampleRate':512,
             'rawSequence':(i+1)*256,'rawEegSamples':[amplitude if j%2 else -amplitude for j in range(256)],
             'quality':{'eegPackets':i+1},'eeg':{'poor_signal':0}}
        if i>=12:
            row['musicFeatures']={'schemaVersion':'music-observations-v1','timestamp':t*1000,'values':{
                'tempo':{'value':84,'unit':'BPM','source':{'type':'human-annotation','id':'synthetic-qa',
                    'uri':'file-id:synthetic-qa','method':'Synthetic browser acceptance fixture; not a performance measurement'}},
                'melody':{'value':60,'unit':'MIDI','source':{'type':'midi-analysis','id':'synthetic-qa',
                    'uri':'file-id:synthetic-qa','method':'Synthetic browser acceptance fixture; not a performance measurement'}}}}
        rows.append(row)
    if full_music:
        values={'melody':(60,'MIDI'),'rhythm':(8,'events/bar'),'harmony':('C major','label'),
                'dynamics':(-18,'dBFS'),'tempo':(84,'BPM'),'mode':('major','label'),
                'form':('section A','label'),'texture':(2,'voices'),'timbre':('strings','label'),
                'articulation':('legato','label')}
        for row in rows:
            row['musicFeatures']={'schemaVersion':'music-observations-v1','timestamp':row['ts']*1000,
                'values':{k:{'value':v,'unit':u,'source':{'type':'human-annotation','id':'synthetic-qa',
                    'uri':'file-id:synthetic-qa','method':'Synthetic browser acceptance fixture; not a performance measurement'}}
                    for k,(v,u) in values.items()}}
    return {'schemaVersion':'neural-resonance-recording-v1','snapshots':rows}
async def metrics(page):
    return await page.evaluate("""()=>{
        const c=document.querySelector('.planar-canvas'),r=c.getBoundingClientRect(),d=c.dataset;
        const size=Number(d.plotSize),left=Number(d.plotLeft),top=Number(d.plotTop);
        const ctx=c.getContext('2d'),img=ctx.getImageData(0,0,c.width,c.height);
        const bg=[img.data[0],img.data[1],img.data[2]];
        let ink=0;for(let i=0;i<img.data.length;i+=4)if(bg.some((v,j)=>Math.abs(img.data[i+j]-v)>8))ink++;
        return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
            canvas:[r.width,r.height],plotSize:size,plotFits:left>=0&&top>=0&&left+size<=r.width&&top+size<=r.height,
            ink,controlsBottom:document.querySelector('.research-transport').getBoundingClientRect().bottom,
            samples:Number(d.samples),segments:Number(d.segments),coordinate:d.coordinate,timestamp:d.timestamp,
            rms:d.rms,intensity:Number(d.intensity),halo:Number(d.halo),background:bg};
    }""")
async def document_probe(browser,raw=False):
    page=await instrument_page(browser,viewport={'width':1920,'height':1080})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    if OPTIONS.source:await page.context.route('http://127.0.0.1:8767/**',source_route)
    if raw:
        response=await page.goto('http://127.0.0.1:8767/docs/PLANAR-METHODS.md')
        body=await response.body();text=await page.locator('body').inner_text()
        result={'contentType':response.headers.get('content-type'),'characterSet':await page.evaluate('document.characterSet'),
            'containsChineseTitle':'二維神經蠕蟲：資料定義、公式與證據邊界' in text,
            'renderedHeadings':await page.locator('h1').count(),
            'responseSha256':hashlib.sha256(body).hexdigest(),
            'sourceSha256':hashlib.sha256((ROOT/'docs/PLANAR-METHODS.md').read_bytes()).hexdigest()}
        await shot(page,f'{MODE}-raw-markdown-1920x1080.png')
        await page.close();return result
    rows=[]
    for name in ['PLANAR-METHODS','EVIDENCE','MUSIC-PLANS','WORM-METHODS','MUSIC-FUSION']:
        response=await page.goto(f'http://127.0.0.1:8767/docs/{name}.html')
        assert response.status==200,(name,response.status)
        await page.locator('article h1').wait_for()
        title=await page.locator('article h1').inner_text()
        text=await page.locator('article').inner_text()
        charset=await page.evaluate('document.characterSet')
        digest=await page.locator('meta[name=source-sha256]').get_attribute('content')
        assert charset.upper()=='UTF-8' and '\ufffd' not in text,(name,charset)
        assert digest==hashlib.sha256((ROOT/f'docs/{name}.md').read_bytes()).hexdigest(),name
        assert title==(ROOT/f'docs/{name}.md').read_text(encoding='utf-8').splitlines()[0][2:],name
        if name in ['MUSIC-PLANS','WORM-METHODS']:assert await page.locator('article table').count()>0
        if name=='PLANAR-METHODS':
            assert '去直流均值' in text and 'AC RMS' in text and '不宣稱診斷' in text
            await shot(page,f'{MODE}-document-1920x1080.png')
        for width,height in [(320,800),(390,844),(1920,1080)]:
            await page.set_viewport_size({'width':width,'height':height})
            assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth'),(name,width)
            if name=='PLANAR-METHODS' and width==390:await shot(page,f'{MODE}-document-390x844.png')
        rows.append({'document':name,'charset':charset,'title':title,'sourceDigestMatches':True,
            'paragraphs':await page.locator('article p').count(),'headings':await page.locator('article h2').count()})
    await page.goto('http://127.0.0.1:8767/#worm')
    await page.wait_for_function("document.querySelector('#research-worm').dataset.ready==='true'")
    await page.locator('.research-method summary').click()
    async with page.expect_popup() as opened:
        await page.locator('.research-method a').first.click()
    document=await opened.value
    await document.wait_for_load_state()
    assert document.url.endswith('/docs/PLANAR-METHODS.html') and await document.evaluate('document.characterSet')=='UTF-8'
    assert await document.locator('article h1').inner_text()=='二維神經蠕蟲：資料定義、公式與證據邊界'
    result={'mode':MODE,'documents':rows,'appLinkOpensRenderedChinese':True,'errors':errors}
    await document.close();await page.close();assert not errors,errors
    return result
async def chopin_probe(browser):
    catalog=json.loads((ROOT/'public/research/vmus-reference-cases.json').read_text(encoding='utf-8'))
    page=await instrument_page(browser,viewport={'width':1920,'height':1080})
    if OPTIONS.source:await page.route('http://127.0.0.1:8767/**',source_route)
    errors=[];responses=[];failures=[];samples=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:responses.append({'url':r.url,'status':r.status}) if r.url in [x['media'] for x in catalog['recordings']] else None)
    await page.goto('http://127.0.0.1:8767/#worm')
    await page.wait_for_function("document.querySelector('#research-worm').dataset.ready==='true'")
    await select_mode(page,'demo')
    await page.locator('[data-visual=music]').click()
    await page.wait_for_function("document.querySelector('[data-role=work]').options.length===2")
    await page.locator('[data-role=audio]').evaluate('(a)=>{a.muted=true;}')
    for rec in catalog['recordings']:
        if await page.locator('[data-role=work]').input_value()!=str(rec['workId']):
            await page.locator('[data-role=work]').select_option(str(rec['workId']))
        await page.locator('[data-role=case]').select_option(rec['id'])
        try:
            await page.locator('[data-action=music-play]').click()
            await page.wait_for_function("document.querySelector('[data-role=audio]').currentTime>.4",timeout=30000)
            sample=await page.locator('[data-role=audio]').evaluate("a=>({time:a.currentTime,readyState:a.readyState,duration:a.duration,url:a.currentSrc,decodedBytes:a.webkitAudioDecodedByteCount??null,paused:a.paused,error:a.error?.code??null})")
            assert sample['url']==rec['media'] and sample['readyState']>=3 and not sample['error'] and not sample['paused'],sample
            if sample['decodedBytes'] is not None:assert sample['decodedBytes']>0,sample
            if rec['completeStudy']:assert abs(sample['duration']-rec['duration'])<1,sample
            await page.locator('[data-action=music-play]').click()
            before=await page.locator('[data-role=audio]').evaluate('(a)=>a.currentTime')
            await page.wait_for_timeout(100)
            assert abs(await page.locator('[data-role=audio]').evaluate('(a)=>a.currentTime')-before)<.02
            t=(rec['annotation']['t'][0]+rec['annotation']['t'][1])/2
            position=round(min(sample['duration']-.1,t),2)
            await page.locator('[data-role=music-seek]').fill(str(position))
            await page.locator('[data-role=music-seek]').dispatch_event('input')
            await page.wait_for_function(f"Math.abs(document.querySelector('[data-role=audio]').currentTime-{position})<.15")
            canvas=await page.locator('.planar-canvas').evaluate('(c)=>({...c.dataset})')
            if rec['completeStudy']:
                await page.locator('button[data-layer=worm]').click()
                await page.locator('[data-role=music-seek]').fill('20');await page.locator('[data-role=music-seek]').dispatch_event('input')
                await page.wait_for_function("document.querySelector('.planar-canvas').dataset.level!==''")
                await page.locator('button[data-layer=profile]').click()
                canvas=await page.locator('.planar-canvas').evaluate('(c)=>({...c.dataset})')
                assert canvas['layer']=='profile' and canvas['band']=='relative-dynamics' and int(canvas['rawPoints'])==len(rec['annotation']['t'])-1,canvas
            else:
                assert await page.locator('[data-role=tempo]').inner_text()=='—'
                assert await page.locator('[data-role=level]').inner_text()=='—'
                assert await page.locator('button[data-layer=worm]').is_disabled()
                assert canvas['layer']=='rhythm'
            if rec['mediaId']==1005:
                assert max(map(float,canvas['rangeY'].split(',')))<10000,canvas
                assert '超出音訊' in await page.locator('[data-role=beat-position]').inner_text()
            samples.append({'id':rec['id'],'mediaId':rec['mediaId'],'workId':rec['workId'],'performer':rec['performer'],'year':rec['year'],**sample,'annotatedRangeWithinMedia':rec['annotation']['t'][-1]<=sample['duration']+.1,'canvas':canvas})
            print(json.dumps({'decoded':len(samples),'mediaId':rec['mediaId']},ensure_ascii=False),flush=True)
        except Exception as e:
            failures.append({'id':rec['id'],'mediaId':rec['mediaId'],'error':str(e)[-700:]})
            await page.locator('[data-role=audio]').evaluate('(a)=>a.pause()')
        (OUT/f'{MODE}-chopin-progress.json').write_text(json.dumps({'decoded':samples,'failures':failures,'browserErrors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
    # Verify the exact screenshot components, keyboard/point navigation and both work comparisons.
    for work in catalog['works']:
        await page.locator('[data-role=work]').select_option(str(work['id']))
        primary=next(r for r in catalog['recordings'] if r['workId']==work['id'] and r['completeStudy'])
        await page.locator('[data-role=case]').select_option(primary['id'])
        await page.locator('button[data-layer=profile]').click()
        await page.locator('[data-role=music-seek]').fill('20');await page.locator('[data-role=music-seek]').dispatch_event('input')
        await shot(page,f'{MODE}-chopin-{work["id"]}-profile-1920x1080.png')
        details=page.locator('.version-comparisons');await details.evaluate('(d)=>{d.open=true}')
        expected=sum(r['completeStudy'] and r['workId']==work['id'] for r in catalog['recordings'])
        await page.wait_for_function(f"document.querySelectorAll('.version-canvas').length==={expected} && document.querySelector('.version-canvas').dataset.band==='relative-dynamics'")
        ranges=await page.locator('.version-canvas').evaluate_all('(cs)=>cs.map(c=>[c.dataset.rangeX,c.dataset.rangeY])')
        assert len(set(tuple(r) for r in ranges))==1,ranges
        await details.scroll_into_view_if_needed();await shot(page,f'{MODE}-chopin-{work["id"]}-versions-1920x1080.png')
        await page.locator('.version-plot .icon-button').nth(1).click()
        await page.wait_for_function("document.querySelector('[data-role=audio]').currentTime>.2")
        await page.locator('[data-role=audio]').evaluate('(a)=>a.pause()')
        await details.evaluate('(d)=>{d.open=false}')
    await page.locator('.planar-canvas').press('ArrowRight')
    data=await page.locator('.planar-canvas').evaluate('(c)=>({...c.dataset})')
    x=float(data['plotLeft'])+(float(data['coordinate'].split(',')[0])-float(data['rangeX'].split(',')[0]))/(float(data['rangeX'].split(',')[1])-float(data['rangeX'].split(',')[0]))*float(data['plotWidth'])
    lo,hi=map(float,data['rangeY'].split(','));y=float(data['plotTop'])+(hi-float(data['tempo']))/(hi-lo)*float(data['plotHeight'])
    await page.locator('.planar-canvas').hover(position={'x':x,'y':y})
    await page.locator('.plot-tooltip:visible').wait_for()
    hit=float((await page.locator('.plot-tooltip').inner_text()).split(' s')[0])
    await page.locator('.planar-canvas').click(position={'x':x,'y':y})
    await page.wait_for_function(f"Math.abs(document.querySelector('[data-role=audio]').currentTime-{hit})<.05")
    await page.locator('[data-role=smoothing]').uncheck()
    assert await page.locator('.planar-canvas').get_attribute('data-band')=='none'
    await page.locator('[data-role=smoothing]').check()
    await page.locator('[data-visual=overlay]').click()
    await page.locator('[data-action=music-play]').click();await page.wait_for_timeout(2200)
    await page.locator('[data-role=audio]').evaluate('(a)=>a.pause()')
    assert int(await page.locator('.planar-canvas').get_attribute('data-paired-samples'))>0
    await shot(page,f'{MODE}-chopin-overlay-profile-1920x1080.png')
    async with page.expect_download() as download:await page.locator('[data-action=export]').click()
    exported=OUT/f'{MODE}-chopin-profile-export.png';await(await download.value).save_as(str(exported));assert exported.stat().st_size>10000
    views=[]
    for w,h in [(320,800),(390,844),(768,1024),(1280,720),(1366,768),(1920,1080),(2560,1440),(3840,2160)]:
        await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(100)
        state=await metrics(page);assert not state['overflow'] and state['plotFits'],state
        await shot(page,f'{MODE}-chopin-profile-{w}x{h}.png');views.append({'width':w,'height':h,**state})
    await page.locator('[data-visual=eeg]').click()
    assert await page.locator('[data-role=audio]').evaluate('(a)=>a.paused')
    await select_mode(page,'live');await page.wait_for_timeout(1000)
    runtime=await page.evaluate("async()=>await(await fetch('/api/runtime')).json()")
    result={'mode':MODE,'coverage':catalog['coverage'],'decoded':samples,'failures':failures,'viewports':views,'browserErrors':errors,'mediaResponses':responses,'runtime':runtime,'speakerOutputVerified':False,'physicalEEGVerified':False,'profileInteractions':True,'sameAxesWithinWork':True}
    await page.close()
    (OUT/f'{MODE}-chopin.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    assert not failures and not errors,{'failures':failures,'errors':errors}
    return {'coverage':catalog['coverage'],'decoded':len(samples),'browserErrors':errors,'viewports':len(views),'mode':MODE}

async def fusion_probe(browser):
    page=await instrument_page(browser,viewport={'width':1920,'height':1080})
    if OPTIONS.source:await page.route('http://127.0.0.1:8767/**',source_route)
    errors=[];responses=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:responses.append({'url':r.url,'status':r.status}) if '.mp3' in r.url else None)
    await page.goto('http://127.0.0.1:8767/#worm')
    await page.wait_for_function("document.querySelector('#research-worm').dataset.ready==='true'")
    runtime=await page.evaluate("async()=>await(await fetch('/api/runtime')).json()")
    await select_mode(page,'demo')
    await page.locator('#research-worm [data-role=scale]').select_option('50')
    scale=await metrics(page)
    ranges=await page.locator('.planar-canvas').evaluate("(c)=>[c.dataset.rangeX,c.dataset.rangeY]")
    assert all(abs(float(r.split(',')[1])-float(r.split(',')[0])-50)<1e-6 for r in ranges)
    await shot(page,f'{MODE}-fine-eeg-1920x1080.png')
    await page.locator('#research-worm [data-visual=music]').click()
    await page.wait_for_function("document.querySelector('[data-role=case]').options.length===4")
    # Decode real source media silently; speaker output is outside this acceptance.
    await page.locator('[data-role=audio]').evaluate("(a)=>{a.muted=true;}")
    options=await page.locator('[data-role=case] option').evaluate_all("(o)=>o.map(p=>({id:p.value,title:p.textContent}))")
    cases=[]
    for option in options:
        await page.locator('[data-role=case]').select_option(option['id'])
        await page.locator('[data-action=music-play]').click()
        await page.wait_for_function("document.querySelector('[data-role=audio]').currentTime>1.2",timeout=40000)
        sample=await page.locator('[data-role=audio]').evaluate("""a=>({time:a.currentTime,readyState:a.readyState,duration:a.duration,
            url:a.currentSrc,decodedBytes:a.webkitAudioDecodedByteCount??null,paused:a.paused,error:a.error?.code??null})""")
        assert not sample['paused'] and not sample['error'] and sample['readyState']>=3,sample
        expected=json.loads((ROOT/'public/research/vmus-reference-cases.json').read_text(encoding='utf-8'))['recordings']
        rec=next(r for r in expected if r['id']==option['id'])
        assert sample['url']==rec['media'] and abs(sample['duration']-rec['duration'])<1, sample
        await page.locator('[data-action=music-play]').click()
        before=await page.locator('[data-role=audio]').evaluate("(a)=>a.currentTime")
        await page.wait_for_timeout(350)
        assert abs(await page.locator('[data-role=audio]').evaluate("(a)=>a.currentTime")-before)<.02
        await page.locator('[data-role=music-seek]').fill('20')
        await page.locator('[data-role=music-seek]').dispatch_event('input')
        await page.wait_for_function("Math.abs(document.querySelector('[data-role=audio]').currentTime-20)<.2")
        await page.wait_for_timeout(120)
        geometry=await metrics(page)
        assert geometry['plotFits'] and not geometry['overflow'],geometry
        canvas=await page.locator('.planar-canvas').evaluate("(c)=>({...c.dataset})")
        assert canvas['layer']=='worm' and float(canvas['musicTime'])>19.8 and canvas['tempo'] and canvas['level']
        await shot(page,f"{MODE}-case-{option['id']}-1920x1080.png")
        cases.append({**option,**sample,'pauseStopsClock':True,'seekUpdatesObservations':True,'canvas':canvas})
    await page.locator('.planar-canvas').press('ArrowRight')
    await page.wait_for_function("Math.abs(document.querySelector('[data-role=audio]').currentTime-21)<.1")
    data=await page.locator('.planar-canvas').evaluate("(c)=>({...c.dataset})")
    low,high=[float(n) for n in data['rangeX'].split(',')]
    x=float(data['plotLeft'])+(float(data['tempo'])-low)/(high-low)*float(data['plotSize'])
    y=float(data['plotTop'])+(1-float(data['level'])/100)*float(data['plotSize'])
    await page.locator('.planar-canvas').hover(position={'x':x,'y':y})
    await page.locator('.plot-tooltip:visible').wait_for()
    hover_time=float((await page.locator('.plot-tooltip').inner_text()).split(' s')[0])
    await page.locator('.planar-canvas').click(position={'x':x,'y':y})
    await page.wait_for_function(f"Math.abs(document.querySelector('[data-role=audio]').currentTime-{hover_time})<.1")
    await page.locator('[data-role=smoothing]').uncheck()
    raw_value=float((await page.locator('[data-role=tempo]').inner_text()).split(' ')[0])
    assert abs(float(await page.locator('.planar-canvas').get_attribute('data-tempo'))-raw_value)<.06
    await shot(page,f'{MODE}-unsmoothed-intervals-1920x1080.png')
    await page.locator('[data-role=smoothing]').check()
    await page.locator('[data-role=case]').select_option(options[0]['id'])
    await page.locator('[data-visual=overlay]').click()
    await page.locator('[data-action=music-play]').click()
    await page.wait_for_function("Number(document.querySelector('.planar-canvas').dataset.pairedSamples)>3",timeout=40000)
    await page.wait_for_timeout(1000)
    paired=await page.locator('.planar-canvas').evaluate("(c)=>Number(c.dataset.pairedSamples)")
    assert '合成示範' in await page.locator('[data-role=source]').inner_text()
    await shot(page,f'{MODE}-overlay-synthetic-eeg-1920x1080.png')
    layers=[]
    for layer in ['tempo','dynamics','rhythm','worm']:
        await page.locator(f'[data-layer={layer}]').click()
        await page.wait_for_timeout(120)
        assert await page.locator('.planar-canvas').get_attribute('data-layer')==layer
        layers.append(layer)
        await shot(page,f'{MODE}-overlay-{layer}-1920x1080.png')
    await page.locator('[data-action=music-play]').click()
    await page.locator('[data-role=music-seek]').fill('25')
    await page.locator('[data-role=music-seek]').dispatch_event('input')
    await page.wait_for_timeout(150)
    assert int(await page.locator('.planar-canvas').get_attribute('data-paired-samples'))==0
    async with page.expect_download() as saved:
        await page.locator('[data-action=export]').click()
    export=OUT/f'{MODE}-overlay-export.png';await(await saved.value).save_as(str(export))
    assert export.stat().st_size>10000
    layouts=[]
    for width,height in [(320,800),(390,844),(768,1024),(1280,720),(1366,768),(1920,1080),(2560,1440),(3840,2160)]:
        await page.set_viewport_size({'width':width,'height':height})
        await page.wait_for_timeout(130)
        info=await metrics(page);assert not info['overflow'] and info['plotFits'],info
        await shot(page,f'{MODE}-music-layout-{width}x{height}.png')
        layouts.append(info)
    await page.set_viewport_size({'width':1920,'height':1080})
    await page.locator('[data-visual=eeg]').click()
    assert await page.locator('[data-role=audio]').evaluate('(a)=>a.paused')
    assert await page.locator('.planar-canvas').get_attribute('data-layer')=='eeg'
    await select_mode(page,'live')
    await page.wait_for_timeout(2000)
    await shot(page,f'{MODE}-actual-device-state-1920x1080.png')
    device_status=await page.locator('#status').inner_text()
    assert '等待' in device_status or runtime['core']['streams']['eeg']['samples']>0,device_status
    assert not errors,errors
    await page.close()
    return {'mode':MODE,'cases':cases,'realSourceMediaDecoded':True,'physicalSpeakerVerified':False,
        'overlaySyntheticEEG':True,'pairedSamples':paired,'layers':layers,'layouts':layouts,
        'fineRange':ranges,'seekStartsNewPairingRun':True,'exportBytes':export.stat().st_size,
        'canvasKeyboardSeek':True,'observedPointHoverAndClick':True,
        'unsmoothedReadoutAndCursorAgree':True,
        'deviceRuntime':runtime,'deviceStatus':device_status,'errors':errors,'audioResponses':responses}
async def theme_probe(browser):
    page=await instrument_page(browser,viewport={'width':1920,'height':1080})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    if OPTIONS.source:await page.route('http://127.0.0.1:8767/**',source_route)
    await page.goto('http://127.0.0.1:8767/')
    await page.wait_for_function("document.querySelector('#research-worm').dataset.ready==='true'")
    rows=[]
    for view in ['waveforms','worm','settings']:
        await page.locator(f'[data-view={view}]').click()
        await page.wait_for_timeout(200)
        row=await page.evaluate("""()=>{
          const css=e=>getComputedStyle(e),sidebar=document.querySelector('.sidebar'),main=document.querySelector('main'),
            heading=document.querySelector('.heading'),nav=document.querySelector('.view-nav'),input=sidebar.querySelector('.input'),
            button=document.querySelector('.outline'),body=css(document.body);
          const s=sidebar.getBoundingClientRect(),h=heading.getBoundingClientRect();
          return {background:body.getPropertyValue('--bg').trim(),text:body.getPropertyValue('--text').trim(),
            accent:body.getPropertyValue('--accent').trim(),font:body.fontFamily,
            sidebar:{width:s.width,left:s.left,top:s.top,height:s.height,background:css(sidebar).backgroundColor},
            navigation:css(nav).flexDirection,headingVisible:h.height>0,
            titleFont:css(document.querySelector('#page-title')).fontSize,
            mainMargin:css(main).marginLeft,mainPadding:css(main).padding,
            sidebarInputVisible:css(input).display!=='none',
            button:{background:css(button).backgroundColor,border:css(button).borderRadius,font:css(button).fontSize}};
        }""")
        rows.append({'view':view,**row})
        await shot(page,f'{MODE}-theme-{view}-1920x1080.png')
    signatures=[json.dumps({k:v for k,v in row.items() if k!='view'},sort_keys=True) for row in rows]
    if OPTIONS.phase in ['unified','fusion','chopin']:
        board=Image.new('RGB',(1280,760),(18,19,21))
        for i,view in enumerate(['waveforms','worm','settings']):
            with Image.open(OUT/f'{MODE}-theme-{view}-1920x1080.png') as image:
                header=image.convert('RGB').resize((1248,702)).crop((0,0,1248,238))
                board.paste(header,(16,8+i*250))
        board.save(OUT/f'{MODE}-three-page-shell-preview.jpg',quality=90)
    await page.set_viewport_size({'width':390,'height':844})
    mobile=[]
    for view in ['waveforms','worm','settings']:
        await page.locator('#nav-toggle').click()
        await page.locator(f'[data-view={view}]').click()
        await page.wait_for_timeout(100)
        closed=await page.locator('#nav-toggle').get_attribute('aria-expanded')=='false'
        title=await page.locator('#page-title').inner_text()
        overflow=await page.evaluate('document.documentElement.scrollWidth>innerWidth')
        mobile.append({'view':view,'menuCloses':closed,'title':title,'overflow':overflow})
        await shot(page,f'{MODE}-theme-{view}-390x844.png')
    result={'threePagesUnified':len(set(signatures))==1,'pages':rows,'mobile':mobile,
            'mobileNavigation':all(row['menuCloses'] and not row['overflow'] for row in mobile),'errors':errors}
    await page.close()
    return result
async def polish_probe(browser):
    tab=await instrument_page(browser,viewport={'width':390,'height':844})
    errors=[]
    tab.on('pageerror',lambda e:errors.append(str(e)))
    if OPTIONS.source:await tab.route('http://127.0.0.1:8767/**',source_route)
    await tab.add_init_script("""(()=>{
      window.__qaSockets=[];
      window.__qaLevel=7;
      window.__qaRawMissing=false;
      window.WebSocket=class {
        constructor(url){
          this.url=String(url);this.closed=false;this.readyState=0;this.count=0;
          window.__qaSockets.push(this.url);
          this.openTimer=setTimeout(()=>{if(this.closed)return;this.readyState=1;this.onopen?.({});
            this.timer=setInterval(()=>{if(this.closed)return;const ts=Date.now()/1000,i=++this.count;
              this.onmessage?.({data:JSON.stringify({schemaVersion:'neural-resonance-live-v1',source:'mock',
                ts,sessionId:'isolated-synthetic-probe',attention:60,meditation:70,eeg:{poor_signal:0},
                quality:{eegPackets:i},rawSequence:i*64,rawUnit:'U'.repeat(80),
                rawDropped:window.__qaRawMissing?64:0,
                rawEegSamples:window.__qaRawMissing?[]:Array.from({length:64},(_,j)=>j%2?window.__qaLevel:-window.__qaLevel),
                musicFeatures:{schemaVersion:'music-observations-v1',timestamp:ts*1000,values:{
                  tempo:{value:84,unit:'BPM',source:{type:'human-annotation',id:'a'.repeat(64),
                    uri:'file-id:synthetic-probe',method:'Explicitly synthetic isolated browser probe'}}}}
              })});
            },100);
          },10);
        }
        close(){this.closed=true;this.readyState=3;clearTimeout(this.openTimer);clearInterval(this.timer);}
      };
    })();""")
    await tab.goto('http://127.0.0.1:8767/#worm')
    await tab.wait_for_function("window.__qaSockets.length>0&&Number(document.querySelector('.planar-canvas')?.dataset.samples)>1")
    endpoint=await tab.locator('#endpoint').input_value()
    await select_mode(tab,'demo')
    sockets=await tab.evaluate('window.__qaSockets.length')
    await select_mode(tab,'live')
    await tab.wait_for_timeout(350)
    live=await tab.evaluate('window.__qaSockets.length')>sockets
    preserved=endpoint==await tab.locator('#endpoint').input_value()
    if not live:
        # Recover the isolated baseline probe through the existing handler.
        # This is not counted as a working visible Live entry.
        await tab.locator('#connect').evaluate('(b)=>b.click()')
    await tab.wait_for_function("document.querySelector('.planar-canvas').dataset.rms==='7'")
    sockets=await tab.evaluate('window.__qaSockets.length')
    await select_mode(tab,'live')
    await tab.wait_for_timeout(200)
    stable=await tab.evaluate('window.__qaSockets.length')==sockets
    await tab.evaluate('window.__qaLevel=.005')
    await tab.wait_for_function("Math.abs(Number(document.querySelector('.planar-canvas').dataset.rms)-.005)<1e-9")
    small=await tab.locator('#research-worm [data-role=amplitude]').inner_text()
    await tab.evaluate('window.__qaLevel=7')
    await tab.wait_for_function("document.querySelector('.planar-canvas').dataset.rms==='7'")
    await tab.evaluate('window.__qaRawMissing=true')
    await tab.wait_for_timeout(300)
    loss_clear=await tab.locator('#research-worm [data-role=amplitude]').inner_text()=='—'
    loss_clear=loss_clear and await tab.locator('.planar-canvas').evaluate("c=>Number(c.dataset.halo)===0")
    await tab.evaluate('window.__qaRawMissing=false')
    await tab.wait_for_function("document.querySelector('.planar-canvas').dataset.rms==='7'")
    await tab.locator('#research-worm [data-action=follow]').click()
    await tab.locator('.planar-music summary').click()
    overflow=await tab.locator('.research-detail').evaluate('(e)=>e.scrollWidth>e.clientWidth+1')
    await tab.evaluate("""()=>{
      window.__qaText=[];window.__qaOriginalText=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){
        const scale=Math.abs(this.getTransform().a)||1;
        window.__qaText.push({text:String(text),width:this.measureText(text).width,capacity:this.canvas.width/scale-40});
        return window.__qaOriginalText.call(this,text,x,y,...rest);
      };
    }""")
    async with tab.expect_download() as saved:
        await tab.locator('#research-worm [data-action=export]').click()
    path=OUT/f'{MODE}-probe-export.png'
    await (await saved.value).save_as(str(path))
    text=await tab.evaluate('window.__qaText')
    clipped=any(row['width']>row['capacity']+1 for row in text)
    with Image.open(path) as image:
        image.thumbnail((1280,1280));image.convert('RGB').save(path.with_suffix('.jpg'),quality=87)
    await shot(tab,f'{MODE}-probe-390x844.png',full=True)
    await select_mode(tab,'demo')
    await tab.wait_for_timeout(250)
    reset=await tab.locator('#research-worm [data-role=state]').inner_text()!='觀察暫停'
    reset=reset and '合成示範' in await tab.locator('#research-worm [data-role=source]').inner_text()
    await tab.close()
    return {'syntheticSocketOnly':True,'liveReconnect':live,'endpointPreserved':preserved,
            'metadataOverflow':overflow,'exportCaptionClipped':clipped,
            'smallAmplitudeVisible':abs(float(small)-.005)<1e-9,'smallAmplitudeText':small,
            'repeatedLiveKeepsConnection':stable,'reportedLossClearsAmplitudeImmediately':loss_clear,
            'sourceChangeClearsFrozenObservation':reset,'errors':errors}
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,channel='msedge')
        if OPTIONS.wire_probe:
            page=await browser.new_page(viewport={'width':1920,'height':1080})
            if OPTIONS.source:await page.route('http://127.0.0.1:8767/**',source_route)
            logs=[]
            page.on('console',lambda m:logs.append({'type':m.type,'message':m.text[:500]}) if m.type=='error' else None)
            def socket(ws):
                logs.append({'socket':ws.url})
                ws.on('socketerror',lambda error:logs.append({'socketError':str(error)[:500]}))
                ws.on('framereceived',lambda message:logs.append({'receivedBytes':len(message)}))
            page.on('websocket',socket)
            await page.goto('http://127.0.0.1:8767/#worm')
            await page.wait_for_timeout(2000)
            await select_mode(page,'demo');await select_mode(page,'live')
            await page.wait_for_timeout(3000)
            before=await page.locator('#status').inner_text()
            await page.context.grant_permissions(['local-network-access'],origin='http://127.0.0.1:8767')
            await page.locator('#connect').click()
            await page.wait_for_timeout(1000)
            print(json.dumps({'logs':logs[:20],'status':await page.locator('#status').inner_text(),
                'beforeScopedPermission':before,'permissionScope':'isolated context / localhost origin only',
                'endpoint':await page.locator('#endpoint').input_value(),'packets':await page.locator('#packets').inner_text(),
                'freshness':await page.locator('#freshness').inner_text()},ensure_ascii=False))
            await browser.close();return
        if OPTIONS.chopin_probe:
            result=await chopin_probe(browser)
            print(json.dumps(result,ensure_ascii=False));return
        if OPTIONS.fusion_probe:
            result=await fusion_probe(browser)
            (OUT/f'{MODE}-fusion.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps({'mode':MODE,'cases':len(result['cases']),'realMediaDecoded':result['realSourceMediaDecoded'],
                'pairedSamples':result['pairedSamples'],'layouts':len(result['layouts']),'layers':result['layers'],
                'errors':result['errors'],'eegSamples':result['deviceRuntime']['core']['streams']['eeg']['samples']},ensure_ascii=False))
            await browser.close();return
        if OPTIONS.raw_doc_probe or OPTIONS.doc_probe:
            result=await document_probe(browser,OPTIONS.raw_doc_probe)
            name='raw-document-before' if OPTIONS.raw_doc_probe else f'{MODE}-documents'
            (OUT/f'{name}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps(result,ensure_ascii=False))
            await browser.close();return
        if OPTIONS.theme_probe:
            result=await theme_probe(browser)
            (OUT/f'{MODE}-theme-probe.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps(result,ensure_ascii=False))
            await browser.close();return
        if OPTIONS.probe:
            result=await polish_probe(browser)
            (OUT/f'{MODE}-probe.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps(result,ensure_ascii=False))
            await browser.close();return
        page=await instrument_page(browser,viewport={'width':1920,'height':1080})
        if OPTIONS.source:await page.route('http://127.0.0.1:8767/**',source_route)
        errors=[];requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url))
        await page.goto('http://127.0.0.1:8767/#worm')
        await page.wait_for_function("document.querySelector('#research-worm').dataset.ready==='true'")
        await page.wait_for_timeout(500)
        await shot(page,f'{MODE}-entry-1920x1080.png')
        assert await page.locator('.planar-canvas:visible').count()==1
        assert not await page.locator('.tonal-canvas').count()
        assert not await page.locator('.element-tabs').is_visible()
        if OPTIONS.quick:
            print(json.dumps({'mode':MODE,'quick':True,'errors':errors,'geometry':await metrics(page)},ensure_ascii=False))
            assert not errors,errors
            await browser.close();return
        await select_mode(page,'demo')
        await page.wait_for_function("Number(document.querySelector('.planar-canvas').dataset.samples)>10")
        assert '合成示範' in await page.locator('#research-worm [data-role=source]').inner_text()
        assert await page.locator('#research-worm [data-role=amplitude]').inner_text()=='—'
        await page.locator('#research-worm [data-action=follow]').click()
        held=await metrics(page);packets=await page.locator('#packets').inner_text()
        await page.wait_for_timeout(600)
        assert (await metrics(page))['timestamp']==held['timestamp']
        assert await page.locator('#packets').inner_text()!=packets
        await page.locator('#research-worm [data-action=follow]').click()
        await page.wait_for_function(f"document.querySelector('.planar-canvas').dataset.timestamp!=='{held['timestamp']}'")
        await page.locator('#research-worm [data-role=cursor]').fill('5')
        assert '歷史樣本'==await page.locator('#research-worm [data-role=state]').inner_text()
        await page.locator('#research-worm [data-action=latest]').click()
        assert '有效資料'==await page.locator('#research-worm [data-role=state]').inner_text()
        await select_mode(page,'replay')
        await page.locator('#research-worm [data-role=file]').set_input_files({
            'name':'synthetic-acceptance.json','mimeType':'application/json',
            'buffer':json.dumps(fixture()).encode()})
        await page.wait_for_function("!document.querySelector('#research-worm [data-action=replay]').disabled")
        await page.locator('#research-worm [data-action=replay]').click()
        await page.wait_for_function("document.querySelector('#research-worm [data-role=amplitude]').textContent==='10.0'")
        low=await metrics(page)
        assert '原始為合成示範' in await page.locator('#research-worm [data-role=source]').inner_text()
        assert not await page.locator('.element-tabs').is_visible()
        await page.wait_for_function("document.querySelector('#research-worm [data-role=amplitude]').textContent==='200.0'")
        high=await metrics(page)
        assert low['coordinate']==high['coordinate'],(low,high)
        assert high['intensity']>low['intensity'] and high['halo']>low['halo'],(low,high)
        await page.wait_for_function("!document.querySelector('[data-element=tempo]').hidden")
        await page.locator('[data-element=tempo]').click()
        assert await page.locator('[data-role=music-value]').inner_text()=='84'
        assert await page.locator('.element-tabs button:visible').count()==2
        await page.locator('[data-element=tempo]').focus()
        await page.keyboard.press('Home')
        assert await page.locator('[data-element=melody]').get_attribute('aria-selected')=='true'
        await shot(page,f'{MODE}-raw-amplitude-1920x1080.png')
        await page.wait_for_function("document.querySelector('#research-worm [data-role=state]').textContent.includes('資料中斷')",timeout=10000)
        interrupted=await metrics(page)
        assert interrupted['halo']==0 and await page.locator('#research-worm [data-role=amplitude]').inner_text()=='—'
        await page.wait_for_function("Number(document.querySelector('.planar-canvas').dataset.segments)===2",timeout=6000)
        await page.locator('#research-worm [data-action=replay]').click()
        assert await page.locator('#research-worm [data-role=amplitude]').inner_text()=='—'
        before=await metrics(page)
        await page.wait_for_timeout(300)
        assert (await metrics(page))['timestamp']==before['timestamp']
        await page.locator('#research-worm [data-action=replay]').click()
        await page.wait_for_timeout(60)
        restarted=await metrics(page)
        assert restarted['samples']<=2 and restarted['segments']==1,restarted
        await page.locator('#research-worm [data-action=follow]').click()
        async with page.expect_download() as download:
            await page.locator('#research-worm [data-action=export]').click()
        await (await download.value).save_as(str(OUT/f'{MODE}-export.png'))
        with Image.open(OUT/f'{MODE}-export.png') as image:
            assert max(ImageStat.Stat(image.convert('RGB')).stddev)>3
            if OPTIONS.phase in ['unified','fusion','chopin']:assert image.convert('RGB').getpixel((0,0))==(18,19,21)
        await select_mode(page,'replay')
        await page.locator('#research-worm [data-role=file]').set_input_files({
            'name':'synthetic-all-elements.json','mimeType':'application/json',
            'buffer':json.dumps(fixture(True)).encode()})
        await page.wait_for_function("!document.querySelector('#research-worm [data-action=replay]').disabled")
        await page.locator('#research-worm [data-action=replay]').click()
        await page.wait_for_function("document.querySelector('.planar-canvas').dataset.samples==='1'")
        await page.locator('#research-worm [data-action=follow]').click()
        assert await page.locator('.element-tabs button:visible').count()==10
        for element in ['melody','rhythm','harmony','dynamics','tempo','mode','form','texture','timbre','articulation']:
            await page.locator(f'[data-element={element}]').click()
            assert await page.locator(f'[data-element={element}]').get_attribute('aria-selected')=='true'
            assert await page.locator('[data-role=music-value]').inner_text()!='—'
        music_layouts=[]
        for w,h in [(390,844),(1280,720),(1920,1080),(3840,2160)]:
            await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(150)
            m=await metrics(page)
            assert not m['overflow'] and m['plotFits'],m
            if w>=1280:assert m['controlsBottom']<=h,m
            await page.locator('[data-element=articulation]').click()
            visibility=await page.locator('[data-role=music-value]').evaluate("""e=>{
                const r=e.getBoundingClientRect(),p=e.closest('.research-detail').getBoundingClientRect();
                return {top:r.top,bottom:r.bottom,containerTop:p.top,containerBottom:p.bottom,viewport:innerHeight};
            }""")
            assert visibility['top']>=max(0,visibility['containerTop']) and visibility['bottom']<=min(visibility['viewport'],visibility['containerBottom']),visibility
            if w<761:await page.evaluate('scrollTo(0,0)')
            music_layouts.append(m);await shot(page,f'{MODE}-music-{w}x{h}.png')
        # Freeze explicit demonstration for deterministic layout screenshots.
        await select_mode(page,'demo')
        await page.locator('#research-worm [data-action=follow]').click()
        layouts=[]
        for w,h in [(320,800),(390,844),(768,1024),(1280,720),(1366,768),(1920,1080),(2560,1440),(3840,2160)]:
            await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(150)
            m=await metrics(page)
            assert not m['overflow'] and m['plotFits'] and m['ink']>200,m
            if OPTIONS.phase in ['unified','fusion','chopin']:
                assert m['background']==[18,19,21],m
                if layouts:assert m['timestamp']==layouts[0]['timestamp'],m
            if w>=1280:assert m['controlsBottom']<=h,m
            layouts.append(m);await shot(page,f'{MODE}-{w}x{h}.png')
        await page.set_viewport_size({'width':1920,'height':1080})
        await page.locator('.worm-legacy>summary').click()
        assert not await page.locator('.worm-legacy>.hero').is_visible()
        await page.locator('#planar-record').click()
        await page.wait_for_timeout(350)
        await page.locator('#planar-record').click()
        async with page.expect_download() as saved:
            await page.locator('#planar-export').click()
        path=OUT/f'{MODE}-synthetic-recording.json'
        await (await saved.value).save_as(str(path))
        recording=json.loads(path.read_text(encoding='utf-8-sig'))
        assert recording['schemaVersion']=='neural-resonance-recording-v1'
        assert recording['snapshots'] and all(p['source']=='demo' for p in recording['snapshots'])
        await page.locator('.worm-legacy>summary').click()
        await page.locator('#research-worm [data-action=focus]').click()
        assert not await page.locator('.sidebar').is_visible()
        await page.keyboard.press('Escape')
        assert await page.locator('.sidebar').is_visible()
        for dpr in [1.5,2]:
            tab=await instrument_page(browser,viewport={'width':1920,'height':1080},device_scale_factor=dpr,reduced_motion='reduce')
            if OPTIONS.source:await tab.route('http://127.0.0.1:8767/**',source_route)
            tab.on('pageerror',lambda e:errors.append(str(e)))
            await tab.goto('http://127.0.0.1:8767/#worm')
            await tab.wait_for_function("document.querySelector('#research-worm').dataset.ready==='true'")
            await select_mode(tab,'demo')
            await tab.locator('#research-worm [data-action=follow]').click()
            a=await metrics(tab);await tab.wait_for_timeout(250);b=await metrics(tab)
            assert a['coordinate']==b['coordinate'] and a['plotFits'] and not a['overflow']
            await shot(tab,f'{MODE}-dpr-{dpr}.png');await tab.close()
        await page.locator('[data-view=waveforms]').click()
        assert await page.locator('#view-waveforms').is_visible()
        await page.locator('[data-view=settings]').click()
        assert await page.locator('#view-settings').is_visible()
        await page.locator('[data-view=worm]').click()
        await shot(page,f'{MODE}-final-1920x1080.png')
        forbidden=[u for u in requests if '/vendor/three/' in u or 'tonal-scene' in u or '.mp3' in u or '.m4a' in u]
        assert not forbidden,forbidden
        polish=await polish_probe(browser) if OPTIONS.phase in ['polish','unified','fusion','chopin'] else None
        if polish:assert polish['liveReconnect'] and polish['endpointPreserved'] and not polish['metadataOverflow'] and not polish['exportCaptionClipped'] and polish['smallAmplitudeVisible'] and polish['repeatedLiveKeepsConnection'] and polish['reportedLossClearsAmplitudeImmediately'] and polish['sourceChangeClearsFrozenObservation'] and not polish['errors'],polish
        theme=await theme_probe(browser) if OPTIONS.phase in ['unified','fusion','chopin'] else None
        if theme:assert theme['threePagesUnified'] and theme['mobileNavigation'] and not theme['errors'],theme
        result={'mode':MODE,'url':page.url,'browser':browser.version,'layouts':layouts,'polish':polish,'theme':theme,
                'sourceLabelCorrect':True,'noRawMeansNoAmplitude':True,'observationPauseKeepsAcquiring':True,
                'replayPauseAndRunIsolation':True,'amplitudeLow':low,'amplitudeHigh':high,
                'gapRemovesGlow':True,'gapSegments':2,'musicOnlyReported':True,'musicLayouts':music_layouts,
                'cursorAndFollow':True,'exportNonblank':True,'recordingExportPreservesDemo':True,'focusAndEscape':True,
                'dpr':[1,1.5,2],'reducedMotion':True,'originalPagesAccessible':True,
                'inactive3DOrUnrelatedAudioRequests':forbidden,'errors':errors,
                'canvasAndExportUseSharedDarkTheme':OPTIONS.phase in ['unified','fusion','chopin'],
                'physicalHardwareVerified':False}
        (OUT/f'{MODE}-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(result,ensure_ascii=False))
        assert not errors,errors
        await browser.close()
asyncio.run(main())
