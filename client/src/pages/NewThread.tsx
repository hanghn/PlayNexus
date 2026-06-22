import useNewThreadForm from "../hooks/useNewThreadForm.ts";

export default function NewThread() {
  const { title, contents, err, handleInputChange, handleSubmit } = useNewThreadForm();

  return (
    <form className="content spacedSection" onSubmit={handleSubmit}>
      <h2>Create new post</h2>
      <div className="tightSection">
        <label className="smallAndGray" htmlFor="new-thread-title">
          Title
        </label>
        <input
          id="new-thread-title"
          className="notTooWide widefill"
          value={title}
          onChange={(e) => handleInputChange(e, "title")}
        />
      </div>
      <div className="tightSection">
        <label className="smallAndGray" htmlFor="new-thread-contents">
          Post contents
        </label>
        <textarea
          id="new-thread-contents"
          className="notTooWide"
          style={{ minHeight: "10rem" }}
          value={contents}
          onChange={(e) => handleInputChange(e, "contents")}
        ></textarea>
      </div>
      {err && <p className="error-message">{err}</p>}
      <div>
        <button className="primary narrow">Create</button>
      </div>
    </form>
  );
}
