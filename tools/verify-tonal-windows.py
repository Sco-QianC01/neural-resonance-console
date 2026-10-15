"""Isolated Edge QA; never opens a personal browser profile."""
import asyncio,json,sys,argparse,mimetypes
from urllib.parse import urlparse,unquote
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'artifacts/worm-academic-20261010/qa-python'))
from playwright.async_api import async_playwright
from PIL import Image
OUT=ROOT/'artifacts/tonal-sphere-20261011/windows-browser'
OUT.mkdir(parents=True,exist_ok=True)
args=argparse.ArgumentParser()
args.add_argument('--baseline',action='store_true')
args.add_argument('--source',action='store_true')
args.add_argument('--quick',action='store_true')
OPTIONS=args.parse_args()
MODE='source' if OPTIONS.source else 'live'
async def source_route(route):
    name=unquote(urlparse(route.request.url).path)
    if name=='/':name='/index.html'
    # This path is a dynamic, sanitized acquisition configuration endpoint.
    # A source preview must not substitute the project's demo fixture.
    if name=='/public/config.json':
        await route.continue_();return
    if name=='/index.html' or name.startswith(('/src/','/public/','/neural-worm/','/docs/')):
        file=(ROOT/name.lstrip('/')).resolve()
        if file.is_relative_to(ROOT) and file.is_file():
            content_type='text/javascript' if file.suffix in ('.js','.mjs') else mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
            await route.fulfill(body=file.read_bytes(),content_type=content_type);return
    await route.continue_()
async def shot(page,name,full=True):
    path=OUT/name
    await page.screenshot(path=str(path),full_page=full)
    with Image.open(path) as image:
        image.thumbnail((1280,1280));image.convert('RGB').save(path.with_name(path.stem+'-preview.jpg'),quality=86)
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,channel='msedge')
        page=await browser.new_page(viewport={'width':1920,'height':1080})
        if OPTIONS.source:await page.route('http://127.0.0.1:8767/**',source_route)
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        await page.goto('http://127.0.0.1:8767/#worm')
        await page.wait_for_selector('.research-canvas')
        if OPTIONS.baseline:
            await page.wait_for_timeout(500)
            await shot(page,'baseline-1920x1080.png')
            print(json.dumps({'baseline':str(OUT/'baseline-1920x1080.png'),'url':page.url,'browser':browser.version}))
            await browser.close();return
        await page.wait_for_function("document.querySelector('#research-worm').dataset.ready==='true'")
        await page.wait_for_function("!document.querySelector('[data-role=seek]').disabled")
        assert not await page.locator('[data-role=scene-error]').is_visible(),await page.locator('[data-role=scene-error]').inner_text()
        await page.wait_for_timeout(600)
        await shot(page,f'{MODE}-sphere-1920x1080.png')
        if OPTIONS.quick:
            await shot(page,f'{MODE}-screen-1920x1080.png',full=False)
            print(json.dumps({'mode':MODE,'errors':errors,'quick':True}));assert not errors,errors
            await browser.close();return
        assert await page.locator('#research-worm').get_attribute('data-chord')=='0:major'
        assert await page.locator('.tonal-canvas').get_attribute('data-anchor-count')=='12'
        assert await page.locator('.pitch-label:visible').count()==3
        assert await page.locator('.element-tabs button').count()==10
        await page.locator('.pitch-choice > summary').click()
        for op,target in [('P','0:minor'),('L','4:minor'),('R','9:minor')]:
            await page.locator('[data-role=root]').select_option('0')
            await page.locator('[data-role=quality]').select_option('major')
            await page.locator(f'[data-transform={op}]').click()
            assert await page.locator('#research-worm').get_attribute('data-chord')==target
            await page.wait_for_timeout(550)
        # The collapsed text entry reaches rear anchors without raycast ambiguity.
        await page.locator('[data-role=root]').select_option('0')
        await page.locator('[data-role=quality]').select_option('major')
        roots=[]
        for _ in range(12):
            roots.append((await page.locator('#research-worm').get_attribute('data-chord')).split(':')[0])
            await page.locator('[data-fifth="1"]').click()
        assert len(set(roots))==12 and await page.locator('#research-worm').get_attribute('data-chord')=='0:major'
        await page.wait_for_timeout(600)
        # Picking a projected label, then dragging the canvas, are distinct.
        await page.locator('.pitch-label[data-pitch="4"]').click()
        assert await page.locator('#research-worm').get_attribute('data-chord')=='4:major'
        await page.locator('[data-action=reset]').click();await page.wait_for_timeout(600)
        canvas=page.locator('.tonal-canvas');before=await canvas.screenshot()
        box=await canvas.bounding_box()
        state=await page.locator('#research-worm').get_attribute('data-chord')
        await page.mouse.move(box['x']+box['width']*.45,box['y']+box['height']*.45)
        await page.mouse.down()
        await page.mouse.move(box['x']+box['width']*.62,box['y']+box['height']*.55,steps=10)
        await page.mouse.up();await page.wait_for_timeout(600)
        assert state==await page.locator('#research-worm').get_attribute('data-chord')
        assert before!=await canvas.screenshot()
        await page.locator('[data-action=reset]').click();await page.wait_for_timeout(600)
        await canvas.focus();await page.keyboard.press('ArrowRight')
        assert await page.locator('#research-worm').get_attribute('data-chord')=='11:major'
        await page.keyboard.press('ArrowLeft');await page.keyboard.press('p')
        assert await page.locator('#research-worm').get_attribute('data-chord')=='4:minor'
        await page.locator('[data-action=audition]').click()
        assert await page.locator('#research-worm').get_attribute('data-audition')=='synthesized'
        await page.locator('[data-role=seek]').fill('12')
        await page.locator('[data-action=reset]').click()
        assert await page.locator('[data-role=seek]').input_value()=='12'
        assert await page.locator('#research-worm').get_attribute('data-chord')=='4:minor'
        selected=[]
        for i in range(10):
            await page.locator(f'.element-tabs [data-layer="{i}"]').click()
            await page.wait_for_timeout(550)
            assert await page.locator(f'.element-tabs [data-layer="{i}"]').get_attribute('aria-selected')=='true'
            assert await page.locator('.research-canvas:visible').count()==1
            selected.append(await page.locator('[data-role=detail-title]').inner_text())
        assert (await page.locator('[data-role=theory-status]').text_content()).strip()==''
        await page.locator('.element-tabs [data-layer="4"]').click()
        await page.wait_for_timeout(800)
        await shot(page,f'{MODE}-tempo-1920x1080.png')
        metric=await page.locator('[data-role=detail-value]').inner_text()
        expected=await page.evaluate("""async()=>{
            const d=await(await fetch('/public/research/vmus-performance.json')).json();
            return d.rows.find(r=>r.t<=12&&12<r.end).tempo.toFixed(0);
        }""")
        assert metric==expected,(metric,expected)
        await page.locator('[data-role=seek]').fill('0')
        assert await page.locator('[data-role=detail-value]').inner_text()=='—'
        await page.locator('[data-role=seek]').fill('12')
        await page.locator('[data-source=eeg]').click();await page.wait_for_timeout(600)
        eeg=await page.locator('[data-role=plot-meta]').inner_text()
        eeg_source=(await page.locator('[data-role=detail-source]').text_content()).strip()
        assert ('合成示範' in eeg)==(eeg_source=='合成示範'),(eeg,eeg_source)
        assert ('記錄回放' in eeg)==(eeg_source=='記錄回放'),(eeg,eeg_source)
        await shot(page,f'{MODE}-eeg-1920x1080.png')
        await page.locator('.element-tabs [data-layer="2"]').click()
        await page.locator('[data-role=root]').select_option('0')
        await page.locator('[data-role=quality]').select_option('major')
        await page.wait_for_timeout(600)
        await page.locator('.pitch-choice > summary').click()
        async with page.expect_download() as download:await page.locator('[data-action=export]').click()
        await (await download.value).save_as(str(OUT/f'{MODE}-export.png'))
        from PIL import ImageStat
        with Image.open(OUT/f'{MODE}-export.png') as image:
            assert max(ImageStat.Stat(image.convert('RGB')).stddev)>3
        geometry=await page.evaluate("""async()=>{
            const {TonalScene}=await import('/src/tonal-scene.mjs');
            const {chord,transform}=await import('/src/tonal-model.mjs');
            const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;width:800px;height:500px';document.body.append(host);
            const scene=new TonalScene(host),ids=scene.anchors.map(n=>({pitch:n.userData.pitch,id:n.id,position:n.position.toArray()}));
            scene.setChord(transform(chord(0,'major'),'P'));
            const after=scene.anchors.map(n=>({pitch:n.userData.pitch,id:n.id,position:n.position.toArray()}));
            scene.camera.updateMatrixWorld(true);
            const right=new (await import('/public/vendor/three/three.module.min.js')).Vector3().setFromMatrixColumn(scene.camera.matrixWorld,0);
            const up=right.clone().setFromMatrixColumn(scene.camera.matrixWorld,1);
            const origin=right.clone().set(0,0,0).project(scene.camera);
            const x=right.multiplyScalar(3.15).project(scene.camera),y=up.multiplyScalar(3.15).project(scene.camera);
            const ratio=Math.abs((x.x-origin.x)*800/((y.y-origin.y)*500));
            const result={anchors:ids,identitiesStable:JSON.stringify(ids)===JSON.stringify(after),referenceSamples:scene.referenceSamples,projectionRatio:ratio};
            scene.dispose();host.remove();return result;
        }""")
        assert len(geometry['anchors'])==12 and len({n['pitch'] for n in geometry['anchors']})==12
        assert geometry['identitiesStable'] and geometry['referenceSamples']>100
        assert abs(geometry['projectionRatio']-1)<.001,geometry
        layouts=[]
        for w,h in [(390,844),(768,1024),(1280,720),(1366,768),(1920,1080),(2560,1440),(3840,2160)]:
            await page.set_viewport_size({'width':w,'height':h});await page.wait_for_timeout(300)
            metrics=await page.evaluate("""()=>{
                const c=document.querySelector('.tonal-canvas'),r=c.getBoundingClientRect();
                const labels=[...document.querySelectorAll('.pitch-label:not([hidden])')].map(l=>{const b=l.getBoundingClientRect();return {text:l.textContent,x:b.x,y:b.y,width:b.width,height:b.height};});
                const gl=c.getContext('webgl2'),data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
                gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);
                let ink=0;for(let i=0;i<data.length;i+=4)if(data[i]<175&&data[i+1]<180&&data[i+2]<190)ink++;
                return {width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,
                    canvas:[r.width,r.height],ink,labels,controlsBottom:document.querySelector('.research-transport').getBoundingClientRect().bottom,
                    tabsBottom:document.querySelector('.element-tabs').getBoundingClientRect().bottom};
            }""")
            assert not metrics['overflow'],metrics
            assert metrics['ink']>200,metrics
            assert len(metrics['labels'])==3,metrics
            if w>=1280:assert metrics['controlsBottom']<=h and metrics['tabsBottom']<=h,metrics
            for label in metrics['labels']:
                assert 0<=label['x']<=w-label['width'] and label['y']>=0,label
            layouts.append(metrics);await shot(page,f'{MODE}-{w}x{h}.png')
        await page.set_viewport_size({'width':1920,'height':1080})
        await page.locator('[data-action=play]').click()
        await page.wait_for_function("document.querySelector('audio').currentTime>13&&!document.querySelector('audio').paused",timeout=30000)
        playback=await page.locator('audio').evaluate('(a)=>({time:a.currentTime,volume:a.volume,muted:a.muted,error:a.error?.code||null})')
        await page.locator('[data-action=play]').click()
        t=await page.locator('audio').evaluate('(a)=>a.currentTime')
        await page.wait_for_timeout(500);assert abs(await page.locator('audio').evaluate('(a)=>a.currentTime')-t)<.1
        await page.locator('[data-role=seek]').fill('37.8');await page.locator('[data-action=play]').click()
        await page.wait_for_function("document.querySelector('audio').ended",timeout=10000)
        await page.locator('[data-role=seek]').fill('12')
        assert await page.locator('[data-role=media-status]').inner_text()!='播放完畢'
        playback.update(pause=True,seekAndEnd=True)
        for dpr in [1.5,2]:
            tab=await browser.new_page(viewport={'width':1920,'height':1080},device_scale_factor=dpr,reduced_motion='reduce')
            if OPTIONS.source:await tab.route('http://127.0.0.1:8767/**',source_route)
            await tab.goto('http://127.0.0.1:8767/#worm')
            await tab.wait_for_function("document.querySelector('#research-worm').dataset.ready==='true'")
            await tab.locator('[data-transform=P]').click()
            await tab.wait_for_timeout(100)
            assert await tab.locator('#research-worm').get_attribute('data-chord')=='0:minor'
            assert not await tab.evaluate('document.documentElement.scrollWidth>innerWidth')
            await shot(tab,f'{MODE}-dpr-{dpr}.png');await tab.close()
        await page.locator('[data-view=waveforms]').click();await page.wait_for_timeout(200)
        assert await page.locator('#view-waveforms').is_visible()
        await page.locator('[data-view=settings]').click();await page.wait_for_timeout(200)
        assert await page.locator('#view-settings').is_visible()
        await page.goto('http://127.0.0.1:8767/#worm')
        await page.wait_for_function("document.querySelector('#research-worm').dataset.ready==='true'")
        await page.wait_for_timeout(600);await shot(page,f'{MODE}-final-1920x1080.png')
        result={'url':page.url,'mode':MODE,'browser':browser.version,'layers':selected,'layouts':layouts,
                'plr':True,'fifths':roots,'picking':True,'dragDoesNotPick':True,'keyboard':True,
                'resetPreservesState':True,'auditionInitiated':True,'playback':playback,'eegLabel':eeg,'eegSource':eeg_source,
                'dpr':[1,1.5,2],'originalPagesAccessible':True,'geometry':geometry,'exportNonblank':True,'errors':errors}
        (OUT/f'{MODE}-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(result,ensure_ascii=False));assert not errors,errors
        await browser.close()
asyncio.run(main())
