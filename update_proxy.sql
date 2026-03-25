CREATE OR REPLACE FUNCTION gemini_proxy(request_url text, request_body text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS `$`$
DECLARE req http_request; resp http_response;
BEGIN req.method := 'POST'; req.uri := request_url; req.content_type := 'application/json'; req.content := request_body; req.headers := ARRAY[http_header('Content-Length', octet_length(request_body)::varchar)]; SELECT * INTO resp FROM http(req); RETURN (resp.content)::json; END; `$`$;
