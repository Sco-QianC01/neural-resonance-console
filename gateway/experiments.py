"""Local listening-study export; immutable folders, no inferred clinical score."""
import base64
import csv
import html
import io
import json
import math
from pathlib import Path
import statistics
import struct
import tempfile
from datetime import datetime, timezone
from uuid import uuid4


def results_root(fallback):
    return Path(fallback) / 'results'


def finite(value):
    return type(value) in (float, int) and math.isfinite(value)


def summary(values):
    values = [v for v in values if finite(v)]
    return {'n': len(values), 'mean': statistics.mean(values) if values else None,
            'sd': statistics.stdev(values) if len(values) > 1 else None}


def correlation(rows, x, y):
    pairs = [(r.get(x), r.get(y)) for r in rows if finite(r.get(x)) and finite(r.get(y))]
    if len(pairs) < 3:
        return {'n': len(pairs), 'r': None}
    a, b = zip(*pairs)
    if min(a) == max(a) or min(b) == max(b):
        return {'n': len(pairs), 'r': None}
    return {'n': len(pairs), 'r': max(-1, min(1, statistics.correlation(a, b)))}


def validate(value):
    if not isinstance(value, dict) or value.get('schema') != 'neural-listening-experiment-v1':
        raise ValueError('无效的实验格式')
    trials = value.get('trials')
    if not isinstance(trials, list) or not 1 <= len(trials) <= 3:
        raise ValueError('实验需要1至3个已完成试次')
    work, ids = None, set()
    for trial in trials:
        rec, rows, packets = trial.get('recording'), trial.get('rows'), trial.get('packets')
        if trial.get('schema') != 'neural-listening-trial-v1' or not isinstance(rec, dict):
            raise ValueError('试次格式无效')
        if not isinstance(rows, list) or not 1 <= len(rows) <= 20000 or not isinstance(packets, list) or not 1 <= len(packets) <= 20000:
            raise ValueError('没有有效设备数据或数据超过上限')
        if work is not None and rec.get('workId') != work or rec.get('id') in ids:
            raise ValueError('需要同一作品的不同版本')
        work = rec.get('workId'); ids.add(rec.get('id'))
        for key in ('title', 'performer', 'id'):
            if not isinstance(rec.get(key), str) or len(rec[key]) > 300:
                raise ValueError('作品信息无效')
        previous = None
        for row in rows:
            if not isinstance(row, dict) or row.get('source') not in ('device', 'core') or row.get('transport') not in ('usb', 'ble'):
                raise ValueError('仅保存现场设备试次')
            for key in ('mediaTime', 'indexTime', 'packetTime', 'attention', 'relaxation'):
                if not finite(row.get(key)):
                    raise ValueError('试次缺少有效时间或指数')
            if not 0 <= row['attention'] <= 100 or not 0 <= row['relaxation'] <= 100:
                raise ValueError('设备指数越界')
            if previous is not None and row['indexTime'] <= previous:
                raise ValueError('指数时间必须递增')
            previous = row['indexTime']
        if any(not isinstance(p, dict) or p.get('source') not in ('device', 'core') or p.get('transport') not in ('usb', 'ble') for p in packets):
            raise ValueError('原始记录包含其他来源')
        trial['statistics'] = {'attention': summary([r['attention'] for r in rows]),
                               'relaxation': summary([r['relaxation'] for r in rows]),
                               **{x+y.title(): correlation(rows, x, y) for x in ('tempo', 'level') for y in ('attention', 'relaxation')}}
    image = value.get('image', '')
    if not isinstance(image, str) or not image.startswith('data:image/png;base64,') or len(image) > 8 * 1024 * 1024:
        raise ValueError('图形必须是有限大小的PNG')
    try:
        image = base64.b64decode(image.split(',', 1)[1], validate=True)
        if len(image) < 33 or image[:8] != b'\x89PNG\r\n\x1a\n' or image[12:16] != b'IHDR':
            raise ValueError()
        width, height = struct.unpack('>II', image[16:24])
        if not 1 <= width <= 8192 or not 1 <= height <= 8192:
            raise ValueError()
        json.dumps(trials, allow_nan=False)
    except (ValueError, TypeError, struct.error) as error:
        raise ValueError('图形或数值格式无效') from error
    return trials, image


def save_experiment(value, root):
    trials, image = validate(value)
    root = Path(root); root.mkdir(parents=True, exist_ok=True)
    name = datetime.now().strftime('%Y%m%d_%H%M%S') + '_聆听实验_' + uuid4().hex[:8]
    destination = root / name
    with tempfile.TemporaryDirectory(prefix='.listening-', dir=root) as temporary:
        target = Path(temporary)
        payload = {'schema': value['schema'], 'savedAt': datetime.now(timezone.utc).isoformat(), 'trials': trials,
                   'formulas': 'mean=Σx/n; sampleSD=√(Σ(x−mean)²/(n−1)); Pearson r=Σ((x−mean_x)(y−mean_y))/√(Σ(x−mean_x)²Σ(y−mean_y)²)',
                   'limitation': '探索性同时相关；未控制时间自相关、伪迹、输出延迟；不证明耦合、因果、审美同质或疗效。'}
        (target / 'experiment.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
        columns = ['version', 'work', 'performer', 'year', 'media_id', 'mediaTime', 'indexTime', 'packetTime', 'segment', 'attention', 'relaxation', 'tempo', 'level', 'bar', 'ioi', 'delta', 'theta', 'alpha', 'beta', 'source', 'transport',
                   'dynamicTier', 'linearFitR2', 'linearFitConstant', 'tempoJump', 'lowAlpha', 'highAlpha', 'lowBeta', 'highBeta', 'lowGamma', 'midGamma', 'barPosition', 'beatInBar', 'beatsPerBar', 'levelSource', 'levelUnit', 'dynamicMark']
        with (target / 'paired.csv').open('w', encoding='utf-8-sig', newline='') as handle:
            writer = csv.writer(handle); writer.writerow(columns)
            for i, trial in enumerate(trials):
                rec = trial['recording']
                for row in trial['rows']:
                    data = [i+1, rec['title'], rec['performer'], rec.get('year'), rec.get('mediaId'),
                            *[row.get(k) for k in columns[5:15]], *[(row.get('bands') or {}).get(k) for k in columns[15:19]], row['source'], row['transport'],
                            *[row.get(k) for k in columns[21:25]], *[(row.get('spectralBands') or {}).get(k) for k in columns[25:31]],
                            *[row.get(k) for k in columns[31:]]]
                    writer.writerow(["'"+v if isinstance(v, str) and v.startswith(('=', '+', '-', '@')) else v for v in data])
        (target / 'figure.png').write_bytes(image)
        rows = []
        for i, trial in enumerate(trials):
            rec, stats = trial['recording'], trial['statistics']
            rows.append('<tr>' + ''.join('<td>'+html.escape(str(v))+'</td>' for v in [i+1, rec['performer'], rec.get('year'), len(trial['rows']), stats['attention'], stats['relaxation'], stats['tempoAttention'], stats['tempoRelaxation']]) + '</tr>')
        report = '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>聆听实验报告</title><style>body{max-width:1100px;margin:40px auto;padding:0 20px;font:15px/1.8 system-ui}table{border-collapse:collapse;font-size:12px}td,th{border:1px solid #ccc;padding:8px;overflow-wrap:anywhere}img{max-width:100%}code{white-space:normal}</style><h1>聆听实验记录</h1><p>'+html.escape(trials[0]['recording']['title'])+'</p><p>'+html.escape(payload['limitation'])+'</p><table><tr><th>版本</th><th>演奏者</th><th>年份</th><th>有效点</th><th>关注</th><th>放松</th><th>速度—关注</th><th>速度—放松</th></tr>'+''.join(rows)+'</table><p><code>'+html.escape(payload['formulas'])+'</code></p><p>n为有效样本数；sd为样本标准差。r未定义时保留空值。完整原始封包、逐时配对、来源与时钟见experiment.json；Excel可打开paired.csv。图形来自当前视图，不代替原始数据。</p><img src="figure.png" alt="当前观测图形"><p>版本年份依来源，不强制相隔50年；秒数不能当作跨版本的共同小节。</p></html>'
        (target / 'report.html').write_text(report, encoding='utf-8')
        target.rename(destination)
    return destination
