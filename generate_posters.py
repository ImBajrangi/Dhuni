#!/usr/bin/env python3
import os
import re
import sys
import subprocess
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

# Paths
BASE_DIR = "/Users/sakhi/AffinityPosters"
TEMPLATE_SVG = os.path.join(BASE_DIR, "Poster.svg")
TOPICS_FILE = os.path.join(BASE_DIR, "topics.txt")
OUTPUT_DIR = os.path.join(BASE_DIR, "Output")

# List of background images to cycle through.
# Left empty to keep the default template background image on all posters.
BG_IMAGES = []

# Chrome executable path on macOS
CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

def make_safe_filename(text):
    """Sanitize the string for safe filenames."""
    safe = re.sub(r'[^\w\s-]', '', text).strip()
    safe = re.sub(r'[-\s]+', '_', safe)
    return safe

def get_unique_paths(topic):
    """Generate unique file paths, using increment prefix if duplicates are found."""
    base_filename = make_safe_filename(topic)
    if not base_filename:
        base_filename = "Poster"
        
    filename = base_filename
    svg_path = os.path.join(OUTPUT_DIR, f"{filename}.svg")
    png_path = os.path.join(OUTPUT_DIR, f"{filename}.png")
    
    counter = 1
    while os.path.exists(svg_path) or os.path.exists(png_path):
        filename = f"{counter}_{base_filename}"
        svg_path = os.path.join(OUTPUT_DIR, f"{filename}.svg")
        png_path = os.path.join(OUTPUT_DIR, f"{filename}.png")
        counter += 1
        
    return svg_path, png_path, filename

def render_png(svg_path, png_path):
    """Render SVG to PNG using Google Chrome in headless mode."""
    cmd = [
        CHROME_PATH,
        "--headless=new",
        "--disable-gpu",
        f"--screenshot={png_path}",
        "--window-size=3840,2160",
        "--default-background-color=00000000",
        f"file://{svg_path}"
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception as e:
        print(f"Error rendering {os.path.basename(svg_path)} to PNG: {e}")
        return False

def clean_topic_from_filename(filename):
    """Intelligently extract and clean song titles from audio file names."""
    # 1. Remove file extension
    name = os.path.splitext(filename)[0]
    
    # 2. Strip leading numbers and standard separators (e.g., "228 - ", "003 - ")
    name = re.sub(r'^\d+\s*[-–—|｜]\s*', '', name)
    
    # 3. Strip Slowed & Reverb suffix variants
    name = re.sub(r'\s*\(\s*Slowed\s*&\s*Reverb\s*\)', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\(\s*Slowed\s*and\s*Reverb\s*\)', '', name, flags=re.IGNORECASE)
    
    # 4. Strip hashtags (e.g., #trending #braj #govind)
    name = re.sub(r'#\w+', '', name)
    
    # 5. Handle special lofi block brackets & vertical dividers: ।।, ｜｜, ｜, ||
    name = name.replace('।।', '|').replace('｜｜', '|').replace('｜', '|').replace('||', '|')
    
    # Split by '|' and take the first non-empty segment (which is the core title)
    segments = [s.strip() for s in name.split('|') if s.strip()]
    if segments:
        name = segments[0]
        
    # 6. Fallback split on hyphens if the first part is a valid song name
    if '-' in name:
        parts = name.split('-')
        if len(parts[0].strip()) > 3:
            name = parts[0].strip()
            
    # Clean up excess spaces, dots, and punctuation
    name = re.sub(r'\s+', ' ', name)
    name = name.strip('। ._-')
    
    return name

def process_topic(topic, template_tree, index=0):
    """Process a single topic, generate SVG, and render it to PNG."""
    topic = topic.strip()
    if not topic:
        return
        
    # Get unique file paths
    svg_path, png_path, filename = get_unique_paths(topic)
    
    # Clone the XML tree to avoid modifying the template for subsequent steps
    import copy
    tree = copy.deepcopy(template_tree)
    root = tree.getroot()
    
    # SVG Namespace
    ns = '{http://www.w3.org/2000/svg}'
    
    # Inject Google Font Import, Shadow Filter, and Gradient in defs element
    defs_elem = None
    for elem in root.iter():
        if elem.tag.endswith('defs'):
            defs_elem = elem
            break
            
    if defs_elem is not None:
        # 1. Font Style Import
        has_style = False
        for child in defs_elem:
            if child.tag.endswith('style') and 'Teko' in (child.text or ''):
                has_style = True
                break
        if not has_style:
            style_elem = ET.Element(f'{ns}style')
            style_elem.text = "@import url('https://fonts.googleapis.com/css2?family=Teko:wght@400;600;700&amp;display=swap');"
            defs_elem.append(style_elem)
            
        # 2. High-Fidelity Drop Shadow Filter (Dark Halo)
        has_filter = False
        for child in defs_elem:
            if child.attrib.get('id') == 'lofi-shadow':
                has_filter = True
                break
        if not has_filter:
            filter_elem = ET.Element(f'{ns}filter')
            filter_elem.attrib['id'] = 'lofi-shadow'
            filter_elem.attrib['x'] = '-20%'
            filter_elem.attrib['y'] = '-20%'
            filter_elem.attrib['width'] = '140%'
            filter_elem.attrib['height'] = '140%'
            
            shadow = ET.Element(f'{ns}feDropShadow')
            shadow.attrib['dx'] = '0'
            shadow.attrib['dy'] = '12'
            shadow.attrib['stdDeviation'] = '18'
            shadow.attrib['flood-color'] = '#050a18'
            shadow.attrib['flood-opacity'] = '0.9'
            
            filter_elem.append(shadow)
            defs_elem.append(filter_elem)
            
        # 3. Soft Metallic Gradient for Text Fill
        has_grad = False
        for child in defs_elem:
            if child.attrib.get('id') == 'text-gradient':
                has_grad = True
                break
        if not has_grad:
            grad_elem = ET.Element(f'{ns}linearGradient')
            grad_elem.attrib['id'] = 'text-gradient'
            grad_elem.attrib['x1'] = '0'
            grad_elem.attrib['y1'] = '0'
            grad_elem.attrib['x2'] = '0'
            grad_elem.attrib['y2'] = '1'
            
            stop1 = ET.Element(f'{ns}stop')
            stop1.attrib['offset'] = '0%'
            stop1.attrib['stop-color'] = '#ffffff'
            
            stop2 = ET.Element(f'{ns}stop')
            stop2.attrib['offset'] = '100%'
            stop2.attrib['stop-color'] = '#e1e7f0'
            
            grad_elem.append(stop1)
            grad_elem.append(stop2)
            defs_elem.append(grad_elem)
            
    # Handle Background Image Replacement
    if BG_IMAGES:
        bg_path = BG_IMAGES[index % len(BG_IMAGES)]
        if os.path.exists(bg_path):
            image_elem = None
            for elem in root.iter():
                if elem.tag.endswith('image') and elem.attrib.get('id') == '_Image1':
                    image_elem = elem
                    break
            if image_elem is not None:
                xlink_ns = '{http://www.w3.org/1999/xlink}href'
                image_elem.attrib[xlink_ns] = f"file://{bg_path}"
                image_elem.attrib['preserveAspectRatio'] = 'xMidYMid slice'
                print(f"[{topic}] Using background image: {os.path.basename(bg_path)}")
            else:
                print(f"Warning: Could not find image element '_Image1' in SVG defs")
        else:
            print(f"Warning: Background image not found: {bg_path}")
    
    # Locate the target group
    target_group = None
    for elem in root.iter():
        if elem.attrib.get('id') == 'Text-TO-Replace':
            target_group = elem
            break
            
    if target_group is None:
        print("Error: Could not find element with id='Text-TO-Replace'")
        return
        
    # Clear child elements (vector paths)
    for child in list(target_group):
        target_group.remove(child)
        
    # Splitting logic: if title is longer than 12 characters and has multiple words, split into 2 lines.
    # Otherwise, render as a single line.
    is_two_lines = False
    words = topic.split()
    if len(topic) > 12 and len(words) > 1:
        # Find best split point to balance line lengths
        best_split = 1
        min_diff = float('inf')
        for i in range(1, len(words)):
            l1 = " ".join(words[:i])
            l2 = " ".join(words[i:])
            diff = abs(len(l1) - len(l2))
            if diff < min_diff:
                min_diff = diff
                best_split = i
        line1 = " ".join(words[:best_split])
        line2 = " ".join(words[best_split:])
        is_two_lines = True
        max_len = max(len(line1), len(line2))
    else:
        max_len = len(topic)
        
    # Calculate optimal font size based on the longest line width.
    base_font_size = 536.69
    estimated_width = max_len * base_font_size * 0.43
    
    if estimated_width > 1700:
        font_size = int(1700 / (max_len * 0.43))
        font_size = max(180, font_size)
    else:
        font_size = int(base_font_size)
        
    # Insert new text node with high-clarity styles (shadow, gradient, spacing, and weight)
    text_elem = ET.Element(f'{ns}text')
    
    style_str = (
        f"font-family:'Teko', 'Teko-Regular', sans-serif;"
        f"font-size:{font_size}px;"
        f"fill:url(#text-gradient);"
        f"filter:url(#lofi-shadow);"
        f"letter-spacing:0.02em;"
        f"text-anchor:middle;"
        f"font-weight:700;"
    )
    
    if is_two_lines:
        text_elem.attrib['style'] = style_str
        
        # Vertically align the two lines around the baseline y=1254.63px
        # Hindi Devanagari script requires a larger line spacing to prevent overlaps of top/bottom matras.
        line_spacing = font_size * 1.12
        y1 = 1254.63 - (line_spacing / 2) + (font_size * 0.1)
        y2 = 1254.63 + (line_spacing / 2) + (font_size * 0.1)
        
        tspan1 = ET.Element(f'{ns}tspan')
        tspan1.attrib['x'] = '2694.5px'
        tspan1.attrib['y'] = f"{y1:.2f}px"
        tspan1.text = line1
        
        tspan2 = ET.Element(f'{ns}tspan')
        tspan2.attrib['x'] = '2694.5px'
        tspan2.attrib['y'] = f"{y2:.2f}px"
        tspan2.text = line2
        
        text_elem.append(tspan1)
        text_elem.append(tspan2)
        print(f"Split '{topic}' into: '{line1}' and '{line2}'")
    else:
        text_elem.attrib['x'] = '2694.5px'
        text_elem.attrib['y'] = '1254.63px'
        text_elem.attrib['style'] = style_str
        text_elem.text = topic
    
    target_group.append(text_elem)
    
    # Save SVG
    try:
        tree.write(svg_path, encoding='UTF-8', xml_declaration=True)
    except Exception as e:
        print(f"Error writing SVG for {topic}: {e}")
        return
        
    # Render PNG
    success = render_png(svg_path, png_path)
    if success:
        print(f"Successfully generated: {filename}.png (Font Size: {font_size}px)")
    else:
        print(f"Failed to render PNG for: {filename}")

def main():
    # Setup namespaces to preserve XML formatting
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
    ET.register_namespace('serif', 'http://www.serif.com/')
    
    # Ensure template exists
    if not os.path.exists(TEMPLATE_SVG):
        print(f"Error: Template poster not found at: {TEMPLATE_SVG}")
        sys.exit(1)
        
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    topics = []
    
    # Read directory if passed as argument
    if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]):
        target_dir = sys.argv[1]
        print(f"Scanning target directory: {target_dir}")
        media_extensions = (
            # Audio formats
            '.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.wma',
            # Video formats
            '.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv'
        )
        try:
            files = [
                f for f in os.listdir(target_dir) 
                if os.path.isfile(os.path.join(target_dir, f)) and f.lower().endswith(media_extensions)
            ]
            for file in sorted(files):
                clean_name = clean_topic_from_filename(file)
                if clean_name:
                    topics.append(clean_name)
                    print(f"Extracted: '{clean_name}' from '{file}'")
        except Exception as e:
            print(f"Error reading directory {target_dir}: {e}")
            
    # Fallback to topics.txt if directory is empty or not passed
    if not topics:
        if not os.path.exists(TOPICS_FILE):
            print(f"Creating a sample topics file at: {TOPICS_FILE}")
            default_topics = [
                "Lofi Reverb",
                "Midnight Chill Beats",
                "Rainy Day Coffee Shop",
                "Slowed Afternoon Waves",
                "Late Night Study Vibes"
            ]
            with open(TOPICS_FILE, 'w') as f:
                f.write('\n'.join(default_topics) + '\n')
                
        with open(TOPICS_FILE, 'r') as f:
            topics = [line.strip() for line in f if line.strip()]
            
    if not topics:
        print(f"Error: No topics found in folder or in topics.txt.")
        sys.exit(1)
        
    print(f"Loaded {len(topics)} topics for generation.")
    print("Parsing SVG template...")
    try:
        template_tree = ET.parse(TEMPLATE_SVG)
    except Exception as e:
        print(f"Error parsing template SVG: {e}")
        sys.exit(1)
        
    print(f"Starting bulk poster generation using up to 4 parallel workers...")
    
    # Use ThreadPoolExecutor to run screenshot renders in parallel
    with ThreadPoolExecutor(max_workers=4) as executor:
        for idx, topic in enumerate(topics):
            executor.submit(process_topic, topic, template_tree, idx)
            
    print("\nBulk generation completed! Check the output folder:")
    print(OUTPUT_DIR)
    
    # Prompt the user to delete intermediate SVG files
    try:
        response = input("\nWould you like to delete the intermediate SVG files and keep only the PNGs? (y/n): ").strip().lower()
        if response in ('y', 'yes'):
            print("Deleting intermediate SVG files...")
            deleted_count = 0
            for file in os.listdir(OUTPUT_DIR):
                if file.endswith('.svg'):
                    try:
                        os.remove(os.path.join(OUTPUT_DIR, file))
                        deleted_count += 1
                    except Exception as e:
                        print(f"Error deleting {file}: {e}")
            print(f"Deleted {deleted_count} SVG files. PNG files preserved.")
        else:
            print("SVG files preserved.")
    except Exception as e:
        print(f"\nCould not prompt for SVG deletion (possibly running in background/non-interactive mode): {e}")
        print("SVG files preserved.")

if __name__ == "__main__":
    main()
