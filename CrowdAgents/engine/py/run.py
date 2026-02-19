"""
运行模拟并生成报告
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import orjson

from simulator import run_simulation
from report_generator import generate_html_report


def main():
    print('[CrowdAgents] 开始模拟...')
    
    report = run_simulation(
        duration_ms=120000,
        seed=42,
        log_level="INFO",
    )
    
    output_dir = Path(__file__).parent.parent / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    json_path = output_dir / "report.json"
    json_path.write_bytes(orjson.dumps(report, option=orjson.OPT_INDENT_2))
    print(f"[CrowdAgents] JSON 报告: {json_path}")
    
    html_path = output_dir / "report.html"
    generate_html_report(str(html_path))
    
    print(f"\n[CrowdAgents] 完成！")
    print(f"[CrowdAgents] 打开 {html_path} 查看报告")


if __name__ == '__main__':
    main()
