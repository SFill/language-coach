"""Image processor for handling image references in content."""

import re
import base64
import os
from dataclasses import dataclass
from typing import List, Optional
from sqlmodel import Session, select
from backend.models.note import NoteImage


@dataclass
class ProcessedContent:
    """Result of image processing."""
    text: str
    image_contents: List[dict]


class ImageProcessor:
    """
    Handles image reference processing in content.
    Single Responsibility: Image-related operations only.
    """
    
    def __init__(self, session: Session):
        """
        Initialize image processor.
        
        Args:
            session: SQLModel database session
        """
        self.session = session
    
    def process_images(self, content: str, note_id: int) -> ProcessedContent:
        """
        Process @image:X references in content.
        
        Args:
            content: Text content with potential @image:X references
            note_id: ID of the note containing the images
            
        Returns:
            ProcessedContent with processed text and image data for AI
        """
        processed_text = content
        image_contents = []
        
        # Find all image references
        image_refs = re.findall(r'@image:(\d+)', content)
        
        for img_id in image_refs:
            image_data = self._load_image(int(img_id), note_id)
            if image_data:
                image_contents.append(image_data)
                # Replace reference with description
                image = self._get_image_record(int(img_id), note_id)
                if image:
                    processed_text = processed_text.replace(
                        f"@image:{img_id}",
                        f"[Image: {image.original_filename}]"
                    )
        
        return ProcessedContent(
            text=processed_text,
            image_contents=image_contents
        )
    
    def _get_image_record(self, image_id: int, note_id: int) -> Optional[NoteImage]:
        """Get image record from database."""
        return self.session.exec(
            select(NoteImage).where(
                NoteImage.id == image_id,
                NoteImage.note_id == note_id
            )
        ).first()
    
    def _load_image(self, image_id: int, note_id: int) -> Optional[dict]:
        """
        Load and encode image for AI API.
        
        Args:
            image_id: ID of the image
            note_id: ID of the note
            
        Returns:
            Dict with image data for OpenAI API, or None if image not found
        """
        try:
            image = self._get_image_record(image_id, note_id)
            if not image or not os.path.exists(image.file_path):
                return None
            
            with open(image.file_path, 'rb') as f:
                image_data = base64.b64encode(f.read()).decode()
            
            return {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{image.mime_type};base64,{image_data}"
                }
            }
        except (ValueError, TypeError, OSError):
            return None
