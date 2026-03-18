// 支持的语言类型
export type SupportedLanguage = 'plaintext' | 'json' | 'javascript' | 'java' | 'sql' | 'python' | 'markdown';

// 语言检测规则
interface LanguageRule {
  language: SupportedLanguage;
  patterns: RegExp[];
  keywords: string[];
  extensions: string[];
}

const languageRules: LanguageRule[] = [
  {
    language: 'plaintext',
    patterns: [],
    keywords: [],
    extensions: ['.txt']
  },
  {
    language: 'json',
    patterns: [
      /^\s*[\{\[]/,
      /["']\s*:\s*["'\[\{]/,
      /}\s*,\s*{/
    ],
    keywords: ['true', 'false', 'null'],
    extensions: ['.json']
  },
  {
    language: 'javascript',
    patterns: [
      /\bfunction\s+\w+\s*\(/,
      /\bconst\s+\w+\s*=/,
      /\blet\s+\w+\s*=/,
      /\bvar\s+\w+\s*=/,
      /\b(if|else|for|while|return)\s*\(/,
      /\b(console\.log|document\.)/,
      /=>\s*[\{\(]/,
      /\bclass\s+\w+/
    ],
    keywords: [
      'function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 
      'return', 'class', 'extends', 'import', 'export', 'async', 'await'
    ],
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  },
  {
    language: 'java',
    patterns: [
      /\bpublic\s+class\s+\w+/,
      /\bpublic\s+static\s+void\s+main/,
      /\bprivate\s+\w+\s+\w+/,
      /\bpublic\s+\w+\s+\w+\s*\(/,
      /\bSystem\.out\.println/,
      /\bString\[\]\s+args/,
      /\bimport\s+java\./,
      /\bpackage\s+[\w\.]+/
    ],
    keywords: [
      'public', 'private', 'protected', 'static', 'final', 'class', 'interface',
      'extends', 'implements', 'import', 'package', 'void', 'int', 'String',
      'boolean', 'double', 'float', 'long', 'short', 'byte', 'char'
    ],
    extensions: ['.java']
  },
  {
    language: 'markdown',
    patterns: [
      /^#+\s+/m,
      /^\s*[-*+]\s+/m,
      /^\s*\d+\.\s+/m,
      /\*\*.*?\*\*/,
      /\*.*?\*/,
      /`.*?`/,
      /^\s*>\s+/m,
      /\[.*?\]\(.*?\)/,
      /^---+$/m,
      /^```/m
    ],
    keywords: [],
    extensions: ['.md', '.markdown']
  },
  {
    language: 'sql',
    patterns: [
      /\bSELECT\s+.+\s+FROM\s+/i,
      /\bINSERT\s+INTO\s+/i,
      /\bUPDATE\s+.+\s+SET\s+/i,
      /\bDELETE\s+FROM\s+/i,
      /\bCREATE\s+(TABLE|DATABASE|INDEX)/i,
      /\bALTER\s+TABLE\s+/i,
      /\bDROP\s+(TABLE|DATABASE|INDEX)/i,
      /\bWHERE\s+.+=/i
    ],
    keywords: [
      'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
      'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'DATABASE',
      'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'NOT', 'NULL', 'UNIQUE',
      'AUTO_INCREMENT', 'DEFAULT'
    ],
    extensions: ['.sql']
  },
  {
    language: 'python',
    patterns: [
      /\bdef\s+\w+\s*\(/,
      /\bclass\s+\w+\s*\(/,
      /\bimport\s+\w+/,
      /\bfrom\s+\w+\s+import/,
      /\bif\s+__name__\s*==\s*['""]__main__['""]:/,
      /\bprint\s*\(/,
      /\belif\s+/,
      /:\s*$/m
    ],
    keywords: [
      'def', 'class', 'import', 'from', 'if', 'elif', 'else', 'for', 'while',
      'try', 'except', 'finally', 'with', 'as', 'pass', 'break', 'continue',
      'return', 'yield', 'lambda', 'and', 'or', 'not', 'in', 'is'
    ],
    extensions: ['.py', '.pyw']
  }
];

// 语言显示名称映射 - 按自然顺序排列
const displayNames: Record<SupportedLanguage, string> = {
  plaintext: 'Plain Text',
  java: 'Java',
  javascript: 'JavaScript',
  json: 'JSON',
  markdown: 'Markdown',
  python: 'Python',
  sql: 'SQL'
};

// 评分系统
interface LanguageScore {
  language: SupportedLanguage;
  score: number;
}

/**
 * 检测代码语言
 */
export function detectLanguage(code: string): SupportedLanguage {
  if (!code || !code.trim()) {
    return 'plaintext'; // 默认返回Plain Text
  }

  const scores: LanguageScore[] = languageRules.map(rule => ({
    language: rule.language,
    score: calculateScore(code, rule)
  }));

  // 按分数排序，取最高分
  scores.sort((a, b) => b.score - a.score);
  
  // 如果最高分大于0，返回对应语言，否则返回Plain Text作为默认值
  return scores[0].score > 0 ? scores[0].language : 'plaintext';
}

/**
 * 计算语言匹配分数
 */
function calculateScore(code: string, rule: LanguageRule): number {
  let score = 0;
  
  // 模式匹配评分
  rule.patterns.forEach(pattern => {
    if (pattern.test(code)) {
      score += 10;
    }
  });
  
  // 关键词匹配评分
  const lowerCode = code.toLowerCase();
  rule.keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
    const matches = lowerCode.match(regex);
    if (matches) {
      score += matches.length * 2;
    }
  });
  
  return score;
}

/**
 * 获取语言显示名称
 */
export function getLanguageDisplayName(language: SupportedLanguage): string {
  return displayNames[language] || language;
}

/**
 * 获取支持的语言列表
 */
export function getSupportedLanguages(): Array<{ value: SupportedLanguage; label: string }> {
  return Object.entries(displayNames).map(([value, label]) => ({
    value: value as SupportedLanguage,
    label
  }));
} 