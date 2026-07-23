class TextSplitter:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str) -> list:
        """
        Splits a long string into smaller overlapping chunks recursively.
        Tries LangChain splitter first, falls back to custom implementation.
        """
        try:
            from langchain.text_splitter import RecursiveCharacterTextSplitter
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.chunk_overlap,
                length_function=len
            )
            return splitter.split_text(text)
        except Exception:
            # Custom Recursive Character Text Splitter Fallback
            return self._custom_split(text, ["\n\n", "\n", " ", ""])

    def _custom_split(self, text: str, separators: list) -> list:
        chunks = []
        if not text:
            return chunks

        # Base case or last separator
        if len(text) <= self.chunk_size or not separators:
            return [text]

        separator = separators[0]
        splits = text.split(separator)
        
        current_chunk = ""
        for part in splits:
            # If the single part exceeds the chunk size, split it further with remaining separators
            if len(part) > self.chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                sub_chunks = self._custom_split(part, separators[1:])
                chunks.extend(sub_chunks)
            else:
                # Accumulate parts
                potential_chunk = (current_chunk + separator + part) if current_chunk else part
                if len(potential_chunk) <= self.chunk_size:
                    current_chunk = potential_chunk
                else:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    # Start new chunk with overlap if possible
                    overlap_source = current_chunk[-self.chunk_overlap:] if len(current_chunk) > self.chunk_overlap else current_chunk
                    current_chunk = overlap_source + separator + part if overlap_source else part

        if current_chunk:
            chunks.append(current_chunk.strip())
            
        return chunks
