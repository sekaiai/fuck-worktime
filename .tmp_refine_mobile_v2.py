#!/usr/bin/env python3
path = "/Users/xueyang/Documents/GitHub/fuck-worktime/week-timesheet-workbench-redesign/pages/mobile-workbench-v2.html"

with open(path, "r", encoding="utf-8") as f:
    html = f.read()

# 1. Ensure flex containers never wrap
html = html.replace('class="flex items-center gap-2"', 'class="flex flex-nowrap items-center gap-2"')

# 2. Add shrink-0 to AI Optimize buttons
html = html.replace(
    'class="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border-strong)] bg-[var(--color-primary-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-primary)]"',
    'class="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--color-border-strong)] bg-[var(--color-primary-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-primary)]"'
)

# 3. Add shrink-0 to Delete buttons
html = html.replace(
    'class="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border)] bg-[var(--wtw-neutral-0)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-danger)]"',
    'class="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--color-border)] bg-[var(--wtw-neutral-0)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-danger)]"'
)

# 4. Rename submit button
html = html.replace(
    '<i data-lucide="send" class="h-4 w-4"></i>\n              调整后提交',
    '<i data-lucide="send" class="h-4 w-4"></i>\n              提交'
)

# 5. Add 草稿 status badges and action buttons to Friday records
friday_record_01 = '''                <div class="flex flex-nowrap items-center justify-between gap-2">
                  <p class="text-sm font-semibold text-[var(--color-text-primary)]">记录 01</p>
                  <span class="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">4.0h</span>
                </div>'''
friday_record_01_new = '''                <div class="flex flex-nowrap items-center justify-between gap-2">
                  <div class="flex flex-nowrap items-center gap-2">
                    <p class="text-sm font-semibold text-[var(--color-text-primary)]">记录 01</p>
                    <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium" style="border-color: color-mix(in srgb, var(--color-warning) 26%, white); color: var(--color-warning); background: color-mix(in srgb, var(--color-warning) 12%, white);">
                      <i data-lucide="clock-3" class="h-3 w-3"></i>
                      草稿
                    </span>
                  </div>
                  <div class="flex flex-nowrap items-center gap-2">
                    <span class="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">4.0h</span>
                    <button type="button" class="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--color-border-strong)] bg-[var(--color-primary-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-primary)]">
                      <i data-lucide="sparkles" class="h-3 w-3"></i>
                      AI 优化
                    </button>
                    <button type="button" class="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--color-border)] bg-[var(--wtw-neutral-0)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-danger)]">
                      <i data-lucide="trash-2" class="h-3 w-3"></i>
                      删除
                    </button>
                  </div>
                </div>'''

friday_record_02 = '''                <div class="flex flex-nowrap items-center justify-between gap-2">
                  <p class="text-sm font-semibold text-[var(--color-text-primary)]">记录 02</p>
                  <span class="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-danger)]">2.5h</span>
                </div>'''
friday_record_02_new = '''                <div class="flex flex-nowrap items-center justify-between gap-2">
                  <div class="flex flex-nowrap items-center gap-2">
                    <p class="text-sm font-semibold text-[var(--color-text-primary)]">记录 02</p>
                    <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium" style="border-color: color-mix(in srgb, var(--color-warning) 26%, white); color: var(--color-warning); background: color-mix(in srgb, var(--color-warning) 12%, white);">
                      <i data-lucide="clock-3" class="h-3 w-3"></i>
                      草稿
                    </span>
                  </div>
                  <div class="flex flex-nowrap items-center gap-2">
                    <span class="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-danger)]">2.5h</span>
                    <button type="button" class="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--color-border-strong)] bg-[var(--color-primary-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-primary)]">
                      <i data-lucide="sparkles" class="h-3 w-3"></i>
                      AI 优化
                    </button>
                    <button type="button" class="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--color-border)] bg-[var(--wtw-neutral-0)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-danger)]">
                      <i data-lucide="trash-2" class="h-3 w-3"></i>
                      删除
                    </button>
                  </div>
                </div>'''

friday_record_03 = '''                <div class="flex flex-nowrap items-center justify-between gap-2">
                  <p class="text-sm font-semibold text-[var(--color-text-primary)]">记录 03</p>
                  <span class="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">2.0h</span>
                </div>'''
friday_record_03_new = '''                <div class="flex flex-nowrap items-center justify-between gap-2">
                  <div class="flex flex-nowrap items-center gap-2">
                    <p class="text-sm font-semibold text-[var(--color-text-primary)]">记录 03</p>
                    <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium" style="border-color: color-mix(in srgb, var(--color-warning) 26%, white); color: var(--color-warning); background: color-mix(in srgb, var(--color-warning) 12%, white);">
                      <i data-lucide="clock-3" class="h-3 w-3"></i>
                      草稿
                    </span>
                  </div>
                  <div class="flex flex-nowrap items-center gap-2">
                    <span class="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">2.0h</span>
                    <button type="button" class="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--color-border-strong)] bg-[var(--color-primary-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-primary)]">
                      <i data-lucide="sparkles" class="h-3 w-3"></i>
                      AI 优化
                    </button>
                    <button type="button" class="inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--color-border)] bg-[var(--wtw-neutral-0)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-danger)]">
                      <i data-lucide="trash-2" class="h-3 w-3"></i>
                      删除
                    </button>
                  </div>
                </div>'''

html = html.replace(friday_record_01, friday_record_01_new, 1)
html = html.replace(friday_record_02, friday_record_02_new, 1)
html = html.replace(friday_record_03, friday_record_03_new, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(html)

print("Refinements applied to mobile-workbench-v2.html")
