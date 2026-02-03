import os
from PIL import Image, ImageDraw, ImageFont

def generate_transparent_text_image(text, filename, add_arrow=False):
    # 图片配置
    width, height = 1024, 512
    font_size = 120  # 字体大小
    
    # 创建透明背景图片
    image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # 字体加载逻辑
    font_paths = [
        "C:/Windows/Fonts/msyhbd.ttf",
        "C:/Windows/Fonts/msyh.ttf",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/arialuni.ttf"
    ]
    
    font = None
    for path in font_paths:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, font_size)
                break
            except Exception:
                continue
    
    if font is None:
        font = ImageFont.load_default()

    # 计算文字位置
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # 文字中心点
    cx = width / 2
    cy = height / 2
    
    # 文字左上角坐标（使其居中）
    x = cx - text_width / 2
    y = cy - text_height / 2 - (bbox[1] / 2)

    # 绘制文字
    draw.text((x, y), text, font=font, fill=(255, 255, 255, 255))
    
    # 如果需要箭头
    if add_arrow:
        # 定义箭头的坐标点 (左下角指向左下)
        # 我们在文字的左下方绘制一个简单的箭头
        # 箭头位置：文字左侧偏下
        arrow_size = 60
        arrow_x = x - arrow_size - 20
        arrow_y = y + text_height + 20
        
        # 绘制箭头线条 (粗细为10)
        # 主干：右上到左下
        start = (arrow_x + arrow_size, arrow_y - arrow_size)
        end = (arrow_x, arrow_y)
        draw.line([start, end], fill=(255, 255, 255, 255), width=10)
        
        # 箭头翼：向上
        wing1 = (arrow_x, arrow_y - arrow_size * 0.6)
        draw.line([end, wing1], fill=(255, 255, 255, 255), width=10)
        
        # 箭头翼：向右
        wing2 = (arrow_x + arrow_size * 0.6, arrow_y)
        draw.line([end, wing2], fill=(255, 255, 255, 255), width=10)

    # 保存图片
    image.save(filename)
    print(f"成功生成图片: {filename} ({text})")

if __name__ == "__main__":
    # 重新生成带箭头的点击开始图片，其他保持不变
    generate_transparent_text_image("点击开始", "static/intro/mouseKeyboardLabel.png", add_arrow=True)
