"""
表达式解析器
用于解析和评估事件触发条件表达式
"""

from typing import Any, Dict, Optional, List, Tuple
import re
from dataclasses import dataclass


@dataclass
class EvaluationContext:
    prev: Any
    curr: Any
    computed: Dict[str, Any]
    events: List[str]
    action_result: Optional[Dict[str, Any]] = None


class ExpressionEvaluator:
    """
    安全的表达式解析器，支持：
    - 属性访问: curr.player.hp, prev.monster.id
    - 比较运算: >, <, ==, !=, >=, <=
    - 逻辑运算: &&, ||, !
    - 空值检查: null, != null
    - 算术运算: +, -, *, /
    - 函数调用: len(), count()
    """
    
    def __init__(self):
        self._cache: Dict[str, Any] = {}
    
    def evaluate(self, expr: str, context: EvaluationContext) -> Any:
        expr = expr.strip()
        
        if not expr:
            return False
        
        if '||' in expr:
            parts = self._split_logical(expr, '||')
            return any(self.evaluate(p, context) for p in parts)
        
        if '&&' in expr:
            parts = self._split_logical(expr, '&&')
            return all(self.evaluate(p, context) for p in parts)
        
        if expr.startswith('!') and not expr.startswith('!='):
            inner = expr[1:].strip()
            if inner.startswith('(') and inner.endswith(')'):
                inner = inner[1:-1]
            return not self.evaluate(inner, context)
        
        if expr.startswith('(') and expr.endswith(')'):
            return self.evaluate(expr[1:-1], context)
        
        comparison_ops = ['!=', '==', '>=', '<=', '>', '<']
        for op in comparison_ops:
            if op in expr:
                left, right = self._split_comparison(expr, op)
                left_val = self.evaluate(left, context)
                right_val = self.evaluate(right, context)
                return self._compare(left_val, right_val, op)
        
        arithmetic_ops = ['+', '-', '*', '/']
        for op in arithmetic_ops:
            if op in expr and not expr.startswith(op):
                parts = expr.split(op, 1)
                if len(parts) == 2:
                    left_val = self.evaluate(parts[0].strip(), context)
                    right_val = self.evaluate(parts[1].strip(), context)
                    return self._arithmetic(left_val, right_val, op)
        
        if expr.isdigit() or (expr.startswith('-') and expr[1:].isdigit()):
            return int(expr)
        
        if expr.replace('.', '', 1).isdigit():
            return float(expr)
        
        if expr == 'null' or expr == 'None':
            return None
        if expr == 'true' or expr == 'True':
            return True
        if expr == 'false' or expr == 'False':
            return False
        
        if expr.startswith('len(') and expr.endswith(')'):
            inner = expr[4:-1]
            val = self.evaluate(inner, context)
            if val is None:
                return 0
            return len(val) if hasattr(val, '__len__') else 0
        
        if expr.startswith('count(') and expr.endswith(')'):
            inner = expr[6:-1]
            val = self.evaluate(inner, context)
            if val is None:
                return 0
            return len(val) if hasattr(val, '__len__') else 0
        
        if expr.startswith('"') and expr.endswith('"'):
            return expr[1:-1]
        if expr.startswith("'") and expr.endswith("'"):
            return expr[1:-1]
        
        if expr in context.computed:
            return context.computed[expr]
        
        if expr in context.events:
            return True
        
        return self._get_attribute(expr, context)
    
    def _split_logical(self, expr: str, op: str) -> List[str]:
        parts = []
        depth = 0
        current = ""
        i = 0
        while i < len(expr):
            if expr[i] == '(':
                depth += 1
                current += expr[i]
            elif expr[i] == ')':
                depth -= 1
                current += expr[i]
            elif depth == 0 and expr[i:i+len(op)] == op:
                parts.append(current.strip())
                current = ""
                i += len(op) - 1
            else:
                current += expr[i]
            i += 1
        if current.strip():
            parts.append(current.strip())
        return parts
    
    def _split_comparison(self, expr: str, op: str) -> Tuple[str, str]:
        idx = expr.find(op)
        return expr[:idx].strip(), expr[idx+len(op):].strip()
    
    def _compare(self, left: Any, right: Any, op: str) -> bool:
        if op == '==':
            return left == right
        elif op == '!=':
            return left != right
        elif op == '>':
            if left is None or right is None:
                return False
            return left > right
        elif op == '<':
            if left is None or right is None:
                return False
            return left < right
        elif op == '>=':
            if left is None or right is None:
                return False
            return left >= right
        elif op == '<=':
            if left is None or right is None:
                return False
            return left <= right
        return False
    
    def _arithmetic(self, left: Any, right: Any, op: str) -> Any:
        if left is None:
            left = 0
        if right is None:
            right = 0
        
        if op == '+':
            return left + right
        elif op == '-':
            return left - right
        elif op == '*':
            return left * right
        elif op == '/':
            if right == 0:
                return 0
            return left / right
        return 0
    
    def _get_attribute(self, path: str, context: EvaluationContext) -> Any:
        parts = path.split('.')
        
        if parts[0] == 'curr':
            obj = context.curr
            parts = parts[1:]
        elif parts[0] == 'prev':
            obj = context.prev
            parts = parts[1:]
        elif parts[0] == 'action_result':
            obj = context.action_result or {}
            parts = parts[1:]
        elif parts[0] == 'computed':
            return context.computed.get('.'.join(parts[1:]))
        else:
            return None
        
        for part in parts:
            if obj is None:
                return None
            
            if hasattr(obj, part):
                obj = getattr(obj, part)
            elif isinstance(obj, dict):
                obj = obj.get(part)
            else:
                return None
        
        return obj


class EventConditionParser:
    """
    事件条件解析器
    将自然语言风格的条件转换为可执行表达式
    """
    
    CONDITION_PATTERNS = {
        r'(\w+) event': lambda m: f'{m.group(1)}',
        r'(\w+) \+ (\w+)': lambda m: f'{m.group(1)} + {m.group(2)}',
        r'(\d+)\+ (\w+)': lambda m: f'{m.group(2)} >= {m.group(1)}',
        r'(\d+)-(\d+)s': lambda m: f'battle_duration_ms >= {int(m.group(1))*1000} && battle_duration_ms <= {int(m.group(2))*1000}',
        r'(\d+)s': lambda m: f'battle_duration_ms >= {int(m.group(1))*1000}',
        r'(\d+) min': lambda m: f'time_ms >= {int(m.group(1))*60000}',
        r'(\d+)min': lambda m: f'time_ms >= {int(m.group(1))*60000}',
        r'floor >= (\d+)': lambda m: f'curr.world.floor >= {m.group(1)}',
        r'HP < (\d+)%': lambda m: f'curr.player.hp * 100 / curr.player.max_hp < {m.group(1)}',
        r'HP ratio < (\d+\.?\d*)': lambda m: f'curr.player.hp / curr.player.max_hp < {m.group(1)}',
    }
    
    def parse(self, condition: str) -> str:
        result = condition
        
        for pattern, converter in self.CONDITION_PATTERNS.items():
            match = re.search(pattern, condition)
            if match:
                result = converter(match)
                break
        
        return result
    
    def parse_trigger(self, trigger: str) -> str:
        """
        解析 evaluation.json 中的 trigger 字段
        """
        trigger = trigger.strip()
        
        if trigger.startswith('"') and trigger.endswith('"'):
            trigger = trigger[1:-1]
        
        trigger = re.sub(r'(\d+)\+', r'>= \1', trigger)
        trigger = re.sub(r'(\d+)-(\d+)', r'between \1 and \2', trigger)
        
        return trigger
