from playwright.sync_api import sync_playwright
import json

def run_browser_automation(script_config):
    """
    Run browser automation based on configuration
    """
    with sync_playwright() as p:
        # Launch browser
        browser_type = script_config.get('browser', 'chromium')
        if browser_type == 'chromium':
            browser = p.chromium.launch(headless=script_config.get('headless', True))
        elif browser_type == 'firefox':
            browser = p.firefox.launch(headless=script_config.get('headless', True))
        elif browser_type == 'webkit':
            browser = p.webkit.launch(headless=script_config.get('headless', True))
        else:
            raise ValueError(f"Unsupported browser: {browser_type}")
        
        # Create context
        context = browser.new_context(
            viewport=script_config.get('viewport', {'width': 1920, 'height': 1080})
        )
        
        # Create page
        page = context.new_page()
        
        try:
            # Execute actions
            for action in script_config.get('actions', []):
                if action['type'] == 'goto':
                    page.goto(action['url'])
                elif action['type'] == 'click':
                    page.click(action['selector'])
                elif action['type'] == 'fill':
                    page.fill(action['selector'], action['value'])
                elif action['type'] == 'screenshot':
                    page.screenshot(path=action['path'])
                elif action['type'] == 'wait':
                    page.wait_for_timeout(action['duration'])
                elif action['type'] == 'wait_for_selector':
                    page.wait_for_selector(action['selector'])
                
            # Return results
            return {
                'success': True,
                'url': page.url,
                'title': page.title()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
        finally:
            browser.close()

if __name__ == "__main__":
    # Example usage
    config = {
        'browser': 'chromium',
        'headless': True,
        'viewport': {'width': 1920, 'height': 1080},
        'actions': [
            {'type': 'goto', 'url': 'https://example.com'},
            {'type': 'screenshot', 'path': '/workspace/screenshot.png'}
        ]
    }
    
    result = run_browser_automation(config)
    print(json.dumps(result, indent=2))
